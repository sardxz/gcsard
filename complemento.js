/**
 * ========================================
 * TRADING TRACKER - SCRIPT PRINCIPAL
 * Sistema Avançado de Rastreamento de Trades
 * ========================================
 */

// === CONFIGURAÇÃO E INICIALIZAÇÃO ===
class TradingTracker {
  constructor() {
    // Cliente Supabase
    this.sb = null;
    
    // Estado da aplicação
    this.state = {
      user: null,
      trades: [],
      filteredTrades: [],
      initialBalance: 0,
      initialTradeValue: 0,
      percentTarget: 0,
      currentTradeValue: 0,
      profileUsername: '',
      isLoading: false,
      sortField: 'trade_date',
      sortOrder: 'desc',
      currentFilters: {
        search: '',
        type: '',
        position: ''
      }
    };

    // Gráficos
    this.charts = {
      balance: null,
      results: null
    };

    // Rate limiting para requests
    this.requestQueue = [];
    this.isProcessingQueue = false;
    
    // Debounce timers
    this.debounceTimers = {};

    // Inicializar aplicação
    this.init();
  }

  // === INICIALIZAÇÃO ===
  async init() {
    try {
      // Inicializar Supabase
      this.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      
      // Configurar event listeners
      this.setupEventListeners();
      
      // Configurar session listeners
      this.setupAuthListeners();
      
      // Inicializar session
      await this.initSession();
      
      // Configurar data padrão
      this.setDefaultDate();
      
      console.log('✅ Trading Tracker inicializado com sucesso');
    } catch (error) {
      console.error('❌ Erro na inicialização:', error);
      this.showNotification('Erro na inicialização da aplicação', 'error');
    }
  }

  // === CONFIGURAÇÃO DE EVENT LISTENERS ===
  setupEventListeners() {
    // === AUTENTICAÇÃO ===
    document.getElementById('btnLogin').addEventListener('click', () => this.openAuthModal('login'));
    document.getElementById('btnLogout').addEventListener('click', () => this.logout());
    document.getElementById('closeAuth1').addEventListener('click', () => this.closeAuthModal());
    document.getElementById('closeAuth2').addEventListener('click', () => this.closeAuthModal());
    document.getElementById('doSignup').addEventListener('click', () => this.signup());
    document.getElementById('doLogin').addEventListener('click', () => this.login());

    // === CONFIGURAÇÕES ===
    document.getElementById('saveSettings').addEventListener('click', () => this.saveSettings());
    document.getElementById('backupData').addEventListener('click', () => this.backupData());

    // === TRADES ===
    document.getElementById('addTradeBtn').addEventListener('click', () => this.addTrade());
    document.getElementById('exportBtn').addEventListener('click', () => this.exportCSV());
    document.getElementById('importBtn').addEventListener('click', () => this.importCSV());
    document.getElementById('resetBtn').addEventListener('click', () => this.resetAll());

    // === BUSCA E FILTROS COM DEBOUNCE ===
    document.getElementById('searchTrades').addEventListener('input', 
      this.debounce(() => this.applyFilters(), 300));
    document.getElementById('filterType').addEventListener('change', () => this.applyFilters());
    document.getElementById('filterPosition').addEventListener('change', () => this.applyFilters());

    // === ABAS DO MODAL DE AUTENTICAÇÃO ===
    document.getElementById('tabSignup').addEventListener('click', () => this.switchAuthTab('signup'));
    document.getElementById('tabLogin').addEventListener('click', () => this.switchAuthTab('login'));

    // === NAVEGAÇÃO POR TECLADO ===
    document.addEventListener('keydown', (e) => this.handleKeyboardNavigation(e));

    // === VALIDAÇÃO EM TEMPO REAL ===
    this.setupRealTimeValidation();

    // === IMPORTAÇÃO DE ARQUIVO ===
    document.getElementById('fileInput').addEventListener('change', (e) => this.handleFileImport(e));

    // === FECHAR MODAL AO CLICAR FORA ===
    document.getElementById('authModal').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.closeAuthModal();
      }
    });

    // === ORDENAÇÃO DA TABELA ===
    document.querySelectorAll('th.sortable').forEach(th => {
      th.addEventListener('click', () => this.sortTable(th.dataset.sort));
      th.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          this.sortTable(th.dataset.sort);
        }
      });
    });
  }

  // === CONFIGURAÇÃO DE VALIDAÇÃO EM TEMPO REAL ===
  setupRealTimeValidation() {
    const inputs = [
      'bankInitial', 'initialTrade', 'percentTarget', 
      'pair', 'percentage', 'signupEmail', 'signupUsername', 'signupPassword'
    ];

    inputs.forEach(inputId => {
      const input = document.getElementById(inputId);
      if (input) {
        input.addEventListener('blur', () => this.validateField(inputId));
        input.addEventListener('input', this.debounce(() => this.validateField(inputId), 500));
      }
    });
  }

  // === LISTENERS DE AUTENTICAÇÃO ===
  setupAuthListeners() {
    this.sb.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Auth state changed:', event);
      
      if (event === 'SIGNED_IN') {
        this.state.user = session?.user || null;
        this.loadEverything();
        this.toggleAuth(true);
        this.showNotification('Login realizado com sucesso!', 'success');
      } else if (event === 'SIGNED_OUT') {
        this.handleSignOut();
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 Token atualizado');
      }
    });
  }

  // === INICIALIZAÇÃO DE SESSÃO ===
  async initSession() {
    this.setLoadingState(true);
    
    try {
      const { data: { session }, error } = await this.sb.auth.getSession();
      
      if (error) {
        console.error('Erro ao obter sessão:', error);
        this.showNotification('Erro na autenticação', 'error');
        return;
      }

      this.state.user = session?.user || null;
      
      if (this.state.user) {
        await this.loadEverything();
        this.toggleAuth(true);
      } else {
        this.toggleAuth(false);
        this.setDefaultValues();
      }
    } catch (error) {
      console.error('Erro na inicialização da sessão:', error);
      this.showNotification('Erro na conexão com o servidor', 'error');
    } finally {
      this.setLoadingState(false);
    }
  }

  // === GERENCIAMENTO DE ESTADO DE LOADING ===
  setLoadingState(isLoading) {
    this.state.isLoading = isLoading;
    
    const buttons = document.querySelectorAll('.btn');
    buttons.forEach(btn => {
      if (isLoading) {
        btn.classList.add('loading');
        btn.disabled = true;
      } else {
        btn.classList.remove('loading');
        btn.disabled = false;
      }
    });

    // Atualizar status da conexão
    this.setConnectionStatus(!isLoading);
  }

  // === AUTENTICAÇÃO ===
  openAuthModal(tab = 'login') {
    this.switchAuthTab(tab);
    const modal = document.getElementById('authModal');
    modal.style.display = 'flex';
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
    
    // Focar no primeiro input
    setTimeout(() => {
      const firstInput = modal.querySelector('input');
      if (firstInput) firstInput.focus();
    }, 100);
  }

  closeAuthModal() {
    const modal = document.getElementById('authModal');
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
    
    setTimeout(() => {
      modal.style.display = 'none';
      this.clearAuthForms();
    }, 200);
  }

  switchAuthTab(tab) {
    const tabSignup = document.getElementById('tabSignup');
    const tabLogin = document.getElementById('tabLogin');
    const bodySignup = document.getElementById('bodySignup');
    const bodyLogin = document.getElementById('bodyLogin');

    if (tab === 'signup') {
      tabSignup.classList.add('active');
      tabSignup.setAttribute('aria-selected', 'true');
      tabLogin.classList.remove('active');
      tabLogin.setAttribute('aria-selected', 'false');
      bodySignup.style.display = 'block';
      bodyLogin.style.display = 'none';
    } else {
      tabLogin.classList.add('active');
      tabLogin.setAttribute('aria-selected', 'true');
      tabSignup.classList.remove('active');
      tabSignup.setAttribute('aria-selected', 'false');
      bodyLogin.style.display = 'block';
      bodySignup.style.display = 'none';
    }
  }

  clearAuthForms() {
    ['signupEmail', 'signupUsername', 'signupPassword', 'loginUsername', 'loginPassword']
      .forEach(id => {
        const input = document.getElementById(id);
        if (input) {
          input.value = '';
          this.clearFieldError(id);
        }
      });
  }

  // === CADASTRO ===
  async signup() {
    const email = document.getElementById('signupEmail').value.trim();
    const username = document.getElementById('signupUsername').value.trim();
    const password = document.getElementById('signupPassword').value.trim();

    // Validação
    if (!this.validateSignupForm(email, username, password)) {
      return;
    }

    this.setLoadingState(true);

    try {
      // 1. Criar usuário no auth
      const { data: signUpData, error: signUpError } = await this.sb.auth.signUp({
        email,
        password,
        options: {
          data: { username } // Metadados do usuário
        }
      });

      if (signUpError) {
        this.showNotification(this.getErrorMessage(signUpError), 'error');
        return;
      }

      const authUserId = signUpData.user?.id;
      if (!authUserId) {
        this.showNotification('Cadastro criado. Confirme seu e-mail e faça login.', 'info');
        return;
      }

      // 2. Criar perfil no banco
      const profileData = {
        id: authUserId,
        email: email,
        username: username,
        bank_initial: 59000,
        initial_trade_value: 2360,
        percent_target: 12
      };

      const { error: profileError } = await this.sb
        .from('profiles')
        .upsert(profileData);

      if (profileError) {
        this.handleProfileError(profileError);
        return;
      }

      // 3. Tentar login automático
      const { error: loginError } = await this.sb.auth.signInWithPassword({
        email,
        password
      });

      if (loginError) {
        this.showNotification('Conta criada com sucesso! Faça login.', 'success');
        this.switchAuthTab('login');
      } else {
        this.closeAuthModal();
        this.showNotification('Cadastro concluído e login efetuado!', 'success');
      }

    } catch (error) {
      console.error('Erro no cadastro:', error);
      this.showNotification('Erro inesperado no cadastro', 'error');
    } finally {
      this.setLoadingState(false);
    }
  }

  // === LOGIN ===
  async login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value.trim();

    if (!this.validateLoginForm(username, password)) {
      return;
    }

    this.setLoadingState(true);

    try {
      // Buscar email pelo username usando RPC
      let email = null;
      try {
        const { data: rpcData, error: rpcError } = await this.sb.rpc('get_email_by_username', {
          p_username: username
        });

        if (rpcError) throw rpcError;
        email = rpcData;
      } catch (rpcError) {
        console.error('Erro RPC:', rpcError);
        this.showNotification(
          'Função de busca não encontrada. Verifique a configuração do banco.', 
          'error'
        );
        return;
      }

      if (!email) {
        this.showNotification('Usuário não encontrado', 'error');
        return;
      }

      // Fazer login
      const { error: loginError } = await this.sb.auth.signInWithPassword({
        email,
        password
      });

      if (loginError) {
        this.showNotification(this.getErrorMessage(loginError), 'error');
        return;
      }

      this.closeAuthModal();

    } catch (error) {
      console.error('Erro no login:', error);
      this.showNotification('Erro inesperado no login', 'error');
    } finally {
      this.setLoadingState(false);
    }
  }

  // === LOGOUT ===
  async logout() {
    if (!confirm('Deseja realmente sair da sua conta?')) {
      return;
    }

    this.setLoadingState(true);

    try {
      const { error } = await this.sb.auth.signOut();
      if (error) {
        console.error('Erro no logout:', error);
        this.showNotification('Erro ao fazer logout', 'error');
      }
      // O evento SIGNED_OUT será disparado automaticamente
    } catch (error) {
      console.error('Erro inesperado no logout:', error);
      this.showNotification('Erro inesperado no logout', 'error');
    } finally {
      this.setLoadingState(false);
    }
  }

  // === MANIPULAR SIGN OUT ===
  handleSignOut() {
    this.state.user = null;
    this.state.trades = [];
    this.state.filteredTrades = [];
    this.state.profileUsername = '';
    
    this.toggleAuth(false);
    this.setDefaultValues();
    this.render();
    this.destroyCharts();
    
    this.showNotification('Logout realizado com sucesso', 'info');
  }

  // === TOGGLE DE AUTENTICAÇÃO ===
  toggleAuth(isLogged) {
    const btnLogin = document.getElementById('btnLogin');
    const btnLogout = document.getElementById('btnLogout');
    
    btnLogin.style.display = isLogged ? 'none' : 'inline-flex';
    btnLogout.style.display = isLogged ? 'inline-flex' : 'none';
    
    this.setWhoAmI(isLogged ? (this.state.profileUsername || this.state.user?.email || '') : '');
    this.setConnectionStatus(isLogged);
  }

  // === DEFINIR USUÁRIO ATUAL ===
  setWhoAmI(name) {
    document.getElementById('whoami').textContent = name || 'Deslogado';
  }

  // === DEFINIR STATUS DE CONEXÃO ===
  setConnectionStatus(online) {
    const dot = document.getElementById('statusDot');
    const txt = document.getElementById('cloudStatus');
    
    if (online) {
      dot.classList.add('online');
      dot.style.background = 'var(--success-color)';
      txt.textContent = 'Online';
    } else {
      dot.classList.remove('online');
      dot.style.background = 'var(--danger-color)';
      txt.textContent = 'Offline';
    }
  }

  // === CARREGAR TODOS OS DADOS ===
  async loadEverything() {
    if (!this.state.user) return;

    this.setLoadingState(true);

    try {
      // Carregar perfil do usuário
      const profile = await this.ensureProfile();
      
      this.state.initialBalance = Number(profile.bank_initial || 0);
      this.state.initialTradeValue = Number(profile.initial_trade_value || 0);
      this.state.percentTarget = Number(profile.percent_target || 0);
      this.state.profileUsername = profile.username || '';

      this.setWhoAmI(this.state.profileUsername || this.state.user?.email || '');

      // Atualizar campos de configuração
      document.getElementById('bankInitial').value = this.state.initialBalance || '';
      document.getElementById('initialTrade').value = this.state.initialTradeValue || '';
      document.getElementById('percentTarget').value = this.state.percentTarget || '';

      // Carregar trades
      await this.loadTrades();

      // Calcular valor do próximo trade
      this.updateCurrentTradeValue();

      // Definir valores padrão nos campos
      document.getElementById('percentage').value = this.state.percentTarget || 12;
      document.getElementById('tradeValue').value = (this.state.currentTradeValue || 0).toFixed(2);

      // Renderizar tudo
      this.render();
      this.createCharts();

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      this.showNotification('Erro ao carregar dados do usuário', 'error');
    } finally {
      this.setLoadingState(false);
    }
  }

  // === GARANTIR PERFIL DO USUÁRIO ===
  async ensureProfile() {
    try {
      const { data: profile, error } = await this.sb
        .from('profiles')
        .select('*')
        .eq('id', this.state.user.id)
        .single();

      // Se não encontrar perfil (PGRST116), criar um novo
      if (error && error.code === 'PGRST116') {
        const defaultProfile = {
          id: this.state.user.id,
          email: this.state.user.email || null,
          username: null,
          bank_initial: 59000,
          initial_trade_value: 2360,
          percent_target: 12
        };

        const { data: newProfile, error: createError } = await this.sb
          .from('profiles')
          .upsert(defaultProfile)
          .select()
          .single();

        if (createError) {
          throw createError;
        }

        return newProfile;
      }

      if (error) {
        throw error;
      }

      return profile;

    } catch (error) {
      console.error('Erro ao garantir perfil:', error);
      this.showNotification('Erro ao acessar perfil do usuário', 'error');
      
      // Retornar perfil padrão como fallback
      return {
        id: this.state.user.id,
        email: this.state.user.email || null,
        username: null,
        bank_initial: 59000,
        initial_trade_value: 2360,
        percent_target: 12
      };
    }
  }

  // === CARREGAR TRADES ===
  async loadTrades() {
    try {
      const { data: trades, error } = await this.sb
        .from('trades')
        .select('*')
        .eq('user_id', this.state.user.id)
        .order('trade_date', { ascending: true });

      if (error) {
        throw error;
      }

      this.state.trades = trades || [];
      this.state.filteredTrades = [...this.state.trades];

    } catch (error) {
      console.error('Erro ao carregar trades:', error);
      this.showNotification('Erro ao carregar histórico de trades', 'error');
      this.state.trades = [];
      this.state.filteredTrades = [];
    }
  }

  // === ATUALIZAR VALOR DO TRADE ATUAL ===
  updateCurrentTradeValue() {
    if (this.state.trades.length > 0) {
      const lastTrade = this.state.trades[this.state.trades.length - 1];
      this.state.currentTradeValue = Number(lastTrade.new_value);
    } else {
      this.state.currentTradeValue = this.state.initialTradeValue;
    }
  }

  // === SALVAR CONFIGURAÇÕES ===
  async saveSettings() {
    if (!this.state.user) {
      this.showNotification('Faça login para salvar configurações', 'error');
      return;
    }

    // Validar campos
    const bank = Number(document.getElementById('bankInitial').value || 0);
    const initValue = Number(document.getElementById('initialTrade').value || 0);
    const percent = Number(document.getElementById('percentTarget').value || 0);

    if (!this.validateSettings(bank, initValue, percent)) {
      return;
    }

    this.setLoadingState(true);

    try {
      const { error } = await this.sb
        .from('profiles')
        .upsert({
          id: this.state.user.id,
          bank_initial: bank,
          initial_trade_value: initValue,
          percent_target: percent
        });

      if (error) {
        throw error;
      }

      // Atualizar estado local
      this.state.initialBalance = bank;
      this.state.initialTradeValue = initValue;
      this.state.percentTarget = percent;

      // Se não há trades, atualizar o valor do trade atual
      if (this.state.trades.length === 0) {
        this.state.currentTradeValue = this.state.initialTradeValue;
        document.getElementById('tradeValue').value = this.state.currentTradeValue.toFixed(2);
      }

      this.render();
      this.updateCharts();
      this.showNotification('Configurações salvas com sucesso!', 'success');

    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      this.showNotification('Erro ao salvar configurações', 'error');
    } finally {
      this.setLoadingState(false);
    }
  }

  // === ADICIONAR TRADE ===
  async addTrade() {
    if (!this.state.user) {
      this.showNotification('Faça login para adicionar trades', 'error');
      return;
    }

    // Coletar dados do formulário
    const tradeData = this.collectTradeData();
    if (!tradeData) return;

    // Validar dados
    if (!this.validateTradeData(tradeData)) {
      return;
    }

    this.setLoadingState(true);

    try {
      // Calcular resultados
      const resultAbs = +(tradeData.value * (tradeData.percent / 100)).toFixed(2);
      const result = tradeData.type === 'profit' ? resultAbs : -resultAbs;
      const newValue = +(tradeData.value + result).toFixed(2);

      // Preparar payload
      const payload = {
        user_id: this.state.user.id,
        trade_date: tradeData.date,
        pair: tradeData.pair.toUpperCase(),
        position: tradeData.position,
        value_trade: tradeData.value,
        type: tradeData.type,
        percent: tradeData.percent,
        result: result,
        new_value: newValue,
        observations: tradeData.observations
      };

      // Inserir no banco
      const { data, error } = await this.sb
        .from('trades')
        .insert(payload)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Adicionar ao estado local
      this.state.trades.push(data);
      this.state.filteredTrades = [...this.state.trades];
      
      // Atualizar valor do próximo trade
      this.state.currentTradeValue = newValue;
      document.getElementById('tradeValue').value = newValue.toFixed(2);

      // Limpar formulário
      this.clearTradeForm();

      // Atualizar interface
      this.render();
      this.updateCharts();
      this.applyFilters();

      this.showNotification('Trade adicionado com sucesso!', 'success');

    } catch (error) {
      console.error('Erro ao adicionar trade:', error);
      this.showNotification('Erro ao adicionar trade', 'error');
    } finally {
      this.setLoadingState(false);
    }
  }

  // === COLETAR DADOS DO TRADE ===
  collectTradeData() {
    return {
      date: document.getElementById('tradeDate').value,
      pair: document.getElementById('pair').value.trim(),
      value: Number(document.getElementById('tradeValue').value),
      position: document.getElementById('position').value,
      type: document.getElementById('resultType').value,
      percent: Number(document.getElementById('percentage').value),
      observations: document.getElementById('observations').value.trim()
    };
  }

  // === LIMPAR FORMULÁRIO DE TRADE ===
  clearTradeForm() {
    document.getElementById('pair').value = '';
    document.getElementById('position').value = '';
    document.getElementById('resultType').value = '';
    document.getElementById('percentage').value = this.state.percentTarget || 12;
    document.getElementById('observations').value = '';

    // Limpar erros de validação
    ['pair', 'position', 'resultType', 'percentage'].forEach(field => {
      this.clearFieldError(field);
    });
  }

  // === REMOVER TRADE ===
  async removeTrade(tradeId) {
    if (!confirm('Deseja realmente remover este trade?')) {
      return;
    }

    this.setLoadingState(true);

    try {
      const { error } = await this.sb
        .from('trades')
        .delete()
        .eq('id', tradeId)
        .eq('user_id', this.state.user.id);

      if (error) {
        throw error;
      }

      // Remover do estado local
      this.state.trades = this.state.trades.filter(t => t.id !== tradeId);
      this.state.filteredTrades = this.state.filteredTrades.filter(t => t.id !== tradeId);

      // Atualizar valor do trade atual
      this.updateCurrentTradeValue();
      document.getElementById('tradeValue').value = (this.state.currentTradeValue || 0).toFixed(2);

      // Atualizar interface
      this.render();
      this.updateCharts();

      this.showNotification('Trade removido com sucesso', 'success');

    } catch (error) {
      console.error('Erro ao remover trade:', error);
      this.showNotification('Erro ao remover trade', 'error');
    } finally {
      this.setLoadingState(false);
    }
  }

  // === APLICAR FILTROS ===
  applyFilters() {
    const searchTerm = document.getElementById('searchTrades').value.toLowerCase().trim();
    const typeFilter = document.getElementById('filterType').value;
    const positionFilter = document.getElementById('filterPosition').value;

    this.state.currentFilters = {
      search: searchTerm,
      type: typeFilter,
      position: positionFilter
    };

    this.state.filteredTrades = this.state.trades.filter(trade => {
      // Filtro de busca
      if (searchTerm) {
        const searchableText = `${trade.pair} ${trade.observations || ''}`.toLowerCase();
        if (!searchableText.includes(searchTerm)) {
          return false;
        }
      }

      // Filtro de tipo
      if (typeFilter && trade.type !== typeFilter) {
        return false;
      }

      // Filtro de posição
      if (positionFilter && trade.position !== positionFilter) {
        return false;
      }

      return true;
    });

    this.renderTable();
    this.showFilterResults();
  }

  // === MOSTRAR RESULTADOS DO FILTRO ===
  showFilterResults() {
    const total = this.state.trades.length;
    const filtered = this.state.filteredTrades.length;

    if (filtered < total) {
      this.showNotification(
        `Mostrando ${filtered} de ${total} trades`, 
        'info'
      );
    }
  }

  // === ORDENAR TABELA ===
  sortTable(field) {
    // Alternar ordem se for o mesmo campo
    if (this.state.sortField === field) {
      this.state.sortOrder = this.state.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.state.sortField = field;
      this.state.sortOrder = 'desc';
    }

    // Aplicar ordenação
    this.state.filteredTrades.sort((a, b) => {
      let aVal = a[field];
      let bVal = b[field];

      // Tratar diferentes tipos de dados
      if (field === 'trade_date') {
        aVal = new Date(aVal);
        bVal = new Date(bVal);
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) return this.state.sortOrder === 'asc' ? -1 : 1;
      if (aVal > bVal) return this.state.sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    this.updateSortHeaders();
    this.renderTable();
  }

  // === ATUALIZAR CABEÇALHOS DE ORDENAÇÃO ===
  updateSortHeaders() {
    document.querySelectorAll('th.sortable').forEach(th => {
      th.classList.remove('sorted', 'desc');
      if (th.dataset.sort === this.state.sortField) {
        th.classList.add('sorted');
        if (this.state.sortOrder === 'desc') {
          th.classList.add('desc');
        }
      }
    });
  }

  // === EXPORTAR CSV ===
  exportCSV() {
    if (this.state.trades.length === 0) {
      this.showNotification('Nenhum trade para exportar', 'warning');
      return;
    }

    try {
      const headers = [
        'Data', 'Paridade', 'Valor Trade', 'Tipo', 'Resultado', 
        'PNL (%)', 'PNL ($)', 'Novo Valor', 'Observações'
      ];

      const rows = this.state.trades.map(trade => {
        const signedPct = (trade.type === 'loss' ? -Number(trade.percent || 0) : Number(trade.percent || 0));
        return [
          trade.trade_date,
          trade.pair || '',
          trade.value_trade,
          (trade.position || '').toUpperCase(),
          trade.type === 'profit' ? 'Lucro' : 'Prejuízo',
          `${signedPct}%`,
          trade.result,
          trade.new_value,
          `"${(trade.observations || '').replace(/"/g, '""')}"`
        ];
      });

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      
      // Adicionar BOM para UTF-8
      const bom = '\uFEFF';
      const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `trades_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      this.showNotification('Dados exportados com sucesso!', 'success');

    } catch (error) {
      console.error('Erro na exportação:', error);
      this.showNotification('Erro ao exportar dados', 'error');
    }
  }

  // === IMPORTAR CSV ===
  importCSV() {
    if (!this.state.user) {
      this.showNotification('Faça login para importar dados', 'error');
      return;
    }

    document.getElementById('fileInput').click();
  }

  // === PROCESSAR ARQUIVO IMPORTADO ===
  async handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      this.showNotification('Por favor, selecione um arquivo CSV', 'error');
      return;
    }

    this.setLoadingState(true);

    try {
      const text = await this.readFileAsText(file);
      const trades = this.parseCSV(text);
      
      if (trades.length === 0) {
        this.showNotification('Nenhum trade válido encontrado no arquivo', 'warning');
        return;
      }

      const result = await this.importTradesData(trades);
      this.showNotification(
        `${result.success} trades importados. ${result.errors} erros.`, 
        result.errors > 0 ? 'warning' : 'success'
      );

    } catch (error) {
      console.error('Erro na importação:', error);
      this.showNotification('Erro ao processar arquivo CSV', 'error');
    } finally {
      this.setLoadingState(false);
      // Limpar input
      event.target.value = '';
    }
  }

  // === RESETAR TODOS OS DADOS ===
  async resetAll() {
    if (!this.state.user) {
      this.showNotification('Faça login para resetar dados', 'error');
      return;
    }

    const confirmed = confirm(
      'ATENÇÃO: Isso apagará TODOS os seus trades permanentemente.\n\n' +
      'Esta ação não pode ser desfeita.\n\n' +
      'Deseja continuar?'
    );

    if (!confirmed) return;

    this.setLoadingState(true);

    try {
      const { error } = await this.sb
        .from('trades')
        .delete()
        .eq('user_id', this.state.user.id);

      if (error) {
        throw error;
      }

      // Limpar estado local
      this.state.trades = [];
      this.state.filteredTrades = [];
      this.state.currentTradeValue = this.state.initialTradeValue;
      
      // Atualizar interface
      document.getElementById('tradeValue').value = this.state.currentTradeValue.toFixed(2);
      this.render();
      this.destroyCharts();
      this.createCharts();

      this.showNotification('Todos os dados foram apagados', 'success');

    } catch (error) {
      console.error('Erro ao resetar dados:', error);
      this.showNotification('Erro ao resetar dados', 'error');
    } finally {
      this.setLoadingState(false);
    }
  }

  // === BACKUP DE DADOS ===
  async backupData() {
    if (!this.state.user) {
      this.showNotification('Faça login para fazer backup', 'error');
      return;
    }

    this.setLoadingState(true);

    try {
      // Coletar todos os dados do usuário
      const profile = await this.ensureProfile();
      
      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        user: {
          email: this.state.user.email,
          username: this.state.profileUsername
        },
        settings: {
          bank_initial: profile.bank_initial,
          initial_trade_value: profile.initial_trade_value,
          percent_target: profile.percent_target
        },
        trades: this.state.trades,
        stats: this.calculateStats()
      };

      // Criar arquivo JSON
      const json = JSON.stringify(backupData, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `trading_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      this.showNotification('Backup criado com sucesso!', 'success');

    } catch (error) {
      console.error('Erro no backup:', error);
      this.showNotification('Erro ao criar backup', 'error');
    } finally {
      this.setLoadingState(false);
    }
  }

  // === NAVEGAÇÃO POR TECLADO ===
  handleKeyboardNavigation(e) {
    // ESC para fechar modal
    if (e.key === 'Escape') {
      this.closeAuthModal();
    }

    // Ctrl+S para salvar configurações
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      if (this.state.user) {
        this.saveSettings();
      }
    }

    // Ctrl+E para exportar
    if (e.ctrlKey && e.key === 'e') {
      e.preventDefault();
      this.exportCSV();
    }

    // Enter para adicionar trade quando em campo de trade
    if (e.key === 'Enter' && e.target.closest('.controls')) {
      const addButton = document.getElementById('addTradeBtn');
      if (!addButton.disabled) {
        this.addTrade();
      }
    }
  }

  // === DEFINIR DATA PADRÃO ===
  setDefaultDate() {
    const today = new Date().toISOString().slice(0, 10);
    document.getElementById('tradeDate').value = today;
  }

  // === DEFINIR VALORES PADRÃO ===
  setDefaultValues() {
    this.setDefaultDate();
    document.getElementById('percentage').value = 12;
    document.getElementById('tradeValue').value = '0.00';
  }
}

// === INICIALIZAR APLICAÇÃO ===
let app;

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Inicializando Trading Tracker...');
  app = new TradingTracker();
});

// === EXPOR FUNÇÃO PARA HTML (removeTrade) ===
window.removeTrade = (tradeId) => {
  if (app) {
    app.removeTrade(tradeId);
  }
};
