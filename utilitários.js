/**
 * ========================================
 * TRADING TRACKER - UTILITÁRIOS E HELPERS
 * Funções auxiliares para o Trading Tracker
 * ========================================
 */

// === EXTENSÕES PARA A CLASSE PRINCIPAL ===
Object.assign(TradingTracker.prototype, {

  // === UTILITÁRIOS DE FORMATAÇÃO ===
  formatMoney(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value || 0);
  },

  formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('pt-BR');
  },

  formatPercent(value, decimals = 1) {
    return `${Number(value || 0).toFixed(decimals)}%`;
  },

  // === SISTEMA DE NOTIFICAÇÕES ===
  showNotification(message, type = 'success', duration = 4000) {
    // Remover notificações anteriores do mesmo tipo
    document.querySelectorAll(`.notification.${type}`).forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 1.1em;">${this.getNotificationIcon(type)}</span>
        <span>${message}</span>
        <button onclick="this.parentElement.parentElement.remove()" 
                style="background: none; border: none; color: white; cursor: pointer; font-size: 1.2em; margin-left: auto;">
          ✕
        </button>
      </div>
    `;

    document.body.appendChild(notification);

    // Animar entrada
    setTimeout(() => notification.classList.add('show'), 50);

    // Auto remover
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, duration);
  },

  getNotificationIcon(type) {
    const icons = {
      success: '✅',
      error: '❌', 
      warning: '⚠️',
      info: 'ℹ️'
    };
    return icons[type] || 'ℹ️';
  },

  // === SISTEMA DE DEBOUNCE ===
  debounce(func, wait) {
    return (...args) => {
      const key = func.toString();
      clearTimeout(this.debounceTimers[key]);
      this.debounceTimers[key] = setTimeout(() => func.apply(this, args), wait);
    };
  },

  // === VALIDAÇÕES ===
  validateField(fieldId) {
    const input = document.getElementById(fieldId);
    if (!input) return true;

    const value = input.value.trim();
    let isValid = true;
    let errorMessage = '';

    switch (fieldId) {
      case 'bankInitial':
        if (!value || Number(value) <= 0) {
          isValid = false;
          errorMessage = 'Banca inicial deve ser maior que zero';
        }
        break;

      case 'initialTrade':
        if (!value || Number(value) <= 0) {
          isValid = false;
          errorMessage = 'Valor do primeiro trade deve ser maior que zero';
        }
        break;

      case 'percentTarget':
        if (!value || Number(value) <= 0 || Number(value) > 100) {
          isValid = false;
          errorMessage = 'Percentual deve estar entre 0 e 100';
        }
        break;

      case 'pair':
        if (!value) {
          isValid = false;
          errorMessage = 'Paridade é obrigatória';
        } else if (!/^[A-Z]{2,10}USDT?$/i.test(value)) {
          isValid = false;
          errorMessage = 'Formato inválido (ex: BTCUSDT)';
        }
        break;

      case 'percentage':
        if (!value || Number(value) <= 0) {
          isValid = false;
          errorMessage = 'Percentual deve ser maior que zero';
        }
        break;

      case 'signupEmail':
        if (!value) {
          isValid = false;
          errorMessage = 'E-mail é obrigatório';
        } else if (!/\S+@\S+\.\S+/.test(value)) {
          isValid = false;
          errorMessage = 'E-mail inválido';
        }
        break;

      case 'signupUsername':
        if (!value) {
          isValid = false;
          errorMessage = 'Nome de usuário é obrigatório';
        } else if (!/^[a-zA-Z0-9_]{3,20}$/.test(value)) {
          isValid = false;
          errorMessage = '3-20 caracteres: letras, números e underscore';
        }
        break;

      case 'signupPassword':
        if (!value) {
          isValid = false;
          errorMessage = 'Senha é obrigatória';
        } else if (value.length < 8) {
          isValid = false;
          errorMessage = 'Senha deve ter pelo menos 8 caracteres';
        }
        break;
    }

    this.setFieldError(fieldId, isValid ? '' : errorMessage);
    return isValid;
  },

  setFieldError(fieldId, message) {
    const formGroup = document.getElementById(fieldId)?.closest('.form-group');
    if (!formGroup) return;

    const errorElement = formGroup.querySelector('.error-message');
    if (errorElement) {
      errorElement.textContent = message;
    }

    if (message) {
      formGroup.classList.add('has-error');
    } else {
      formGroup.classList.remove('has-error');
    }
  },

  clearFieldError(fieldId) {
    this.setFieldError(fieldId, '');
  },

  // === VALIDAÇÕES ESPECÍFICAS ===
  validateSignupForm(email, username, password) {
    let isValid = true;

    if (!this.validateField('signupEmail')) isValid = false;
    if (!this.validateField('signupUsername')) isValid = false;
    if (!this.validateField('signupPassword')) isValid = false;

    if (!email || !username || !password) {
      this.showNotification('Preencha todos os campos obrigatórios', 'error');
      isValid = false;
    }

    return isValid;
  },

  validateLoginForm(username, password) {
    let isValid = true;

    if (!username || !password) {
      this.showNotification('Preencha usuário e senha', 'error');
      isValid = false;
    }

    if (username && username.length < 3) {
      this.showNotification('Nome de usuário deve ter pelo menos 3 caracteres', 'error');
      isValid = false;
    }

    return isValid;
  },

  validateSettings(bank, initValue, percent) {
    let isValid = true;

    if (!this.validateField('bankInitial')) isValid = false;
    if (!this.validateField('initialTrade')) isValid = false;
    if (!this.validateField('percentTarget')) isValid = false;

    if (bank <= 0 || initValue <= 0 || percent <= 0) {
      this.showNotification('Todos os valores devem ser maiores que zero', 'error');
      isValid = false;
    }

    if (initValue >= bank) {
      this.showNotification('Valor do primeiro trade deve ser menor que a banca inicial', 'error');
      isValid = false;
    }

    return isValid;
  },

  validateTradeData(data) {
    let isValid = true;

    const requiredFields = ['date', 'pair', 'position', 'type', 'percent'];
    requiredFields.forEach(field => {
      if (!data[field]) {
        this.showNotification(`Campo ${field} é obrigatório`, 'error');
        isValid = false;
      }
    });

    if (data.percent <= 0 || data.percent > 100) {
      this.showNotification('Percentual deve estar entre 0 e 100', 'error');
      isValid = false;
    }

    if (data.value <= 0) {
      this.showNotification('Valor do trade deve ser maior que zero', 'error');
      isValid = false;
    }

    // Validar data não futura
    const tradeDate = new Date(data.date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    if (tradeDate > today) {
      this.showNotification('Data do trade não pode ser no futuro', 'error');
      isValid = false;
    }

    return isValid;
  },

  // === TRATAMENTO DE ERROS ===
  getErrorMessage(error) {
    const errorMessages = {
      'Invalid login credentials': 'Credenciais inválidas. Verifique usuário e senha.',
      'Email not confirmed': 'Confirme seu e-mail antes de fazer login.',
      'Too many requests': 'Muitas tentativas. Tente novamente em alguns minutos.',
      'User already registered': 'E-mail já cadastrado. Faça login ou use outro e-mail.',
      'Password should be at least 6 characters': 'Senha deve ter pelo menos 6 caracteres.',
      'Unable to validate email address': 'E-mail inválido.',
      'signup_disabled': 'Cadastro de novos usuários desabilitado.',
    };

    return errorMessages[error.message] || error.message || 'Erro desconhecido';
  },

  handleProfileError(error) {
    if (error.message?.toLowerCase().includes('duplicate') || 
        error.message?.toLowerCase().includes('unique')) {
      this.showNotification('Nome de usuário já está em uso. Escolha outro.', 'error');
    } else {
      console.error('Erro no perfil:', error);
      this.showNotification('Erro ao salvar perfil: ' + error.message, 'error');
    }
  },

  // === UTILITÁRIOS DE ARQUIVO ===
  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Erro ao ler arquivo'));
      reader.readAsText(file, 'utf-8');
    });
  },

  parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length <= 1) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const trades = [];

    for (let i = 1; i < lines.length; i++) {
      const values = this.parseCSVLine(lines[i]);
      if (values.length !== headers.length) continue;

      const trade = {};
      headers.forEach((header, index) => {
        trade[header] = values[index]?.trim() || '';
      });

      // Converter e validar dados
      const processedTrade = this.processImportedTrade(trade);
      if (processedTrade) {
        trades.push(processedTrade);
      }
    }

    return trades;
  },

  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current);
    return result;
  },

  processImportedTrade(trade) {
    try {
      // Mapear campos comuns
      const processed = {
        trade_date: this.parseImportDate(trade.data || trade.date),
        pair: (trade.paridade || trade.pair || '').toUpperCase(),
        position: this.parseImportPosition(trade.tipo || trade.position),
        type: this.parseImportType(trade.resultado || trade.type),
        percent: this.parseImportNumber(trade['pnl (%)'] || trade.percent),
        result: this.parseImportNumber(trade['pnl ($)'] || trade.result),
        value_trade: this.parseImportNumber(trade['valor trade'] || trade.value_trade),
        new_value: this.parseImportNumber(trade['novo valor'] || trade.new_value),
        observations: trade.observações || trade.observations || ''
      };

      // Validar dados essenciais
      if (!processed.trade_date || !processed.pair || !processed.type) {
        return null;
      }

      return processed;
    } catch (error) {
      console.warn('Erro ao processar linha:', error);
      return null;
    }
  },

  parseImportDate(dateStr) {
    if (!dateStr) return null;
    
    // Tentar diferentes formatos
    const formats = [
      /(\d{4})-(\d{2})-(\d{2})/,           // YYYY-MM-DD
      /(\d{2})\/(\d{2})\/(\d{4})/,         // DD/MM/YYYY
      /(\d{2})-(\d{2})-(\d{4})/            // DD-MM-YYYY
    ];

    for (const format of formats) {
      const match = dateStr.match(format);
      if (match) {
        if (format === formats[0]) {
          // YYYY-MM-DD
          return `${match[1]}-${match[2]}-${match[3]}`;
        } else {
          // DD/MM/YYYY ou DD-MM-YYYY
          return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
        }
      }
    }

    return null;
  },

  parseImportPosition(positionStr) {
    if (!positionStr) return 'long';
    const pos = positionStr.toLowerCase();
    return pos.includes('short') ? 'short' : 'long';
  },

  parseImportType(typeStr) {
    if (!typeStr) return 'profit';
    const type = typeStr.toLowerCase();
    return type.includes('prejuízo') || type.includes('loss') ? 'loss' : 'profit';
  },

  parseImportNumber(numStr) {
    if (!numStr) return 0;
    
    // Remover símbolos e espaços
    const cleaned = String(numStr)
      .replace(/[$%\s]/g, '')
      .replace(/,/g, '.')
      .replace(/[^\d.-]/g, '');
    
    return Number(cleaned) || 0;
  },

  async importTradesData(trades) {
    let successCount = 0;
    let errorCount = 0;

    for (const trade of trades) {
      try {
        const payload = {
          ...trade,
          user_id: this.state.user.id
        };

        const { error } = await this.sb
          .from('trades')
          .insert(payload);

        if (error) {
          console.error('Erro ao importar trade:', error);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (error) {
        console.error('Erro inesperado na importação:', error);
        errorCount++;
      }
    }

    // Recarregar dados após importação
    if (successCount > 0) {
      await this.loadTrades();
      this.updateCurrentTradeValue();
      this.render();
      this.updateCharts();
    }

    return { success: successCount, errors: errorCount };
  },

  // === CÁLCULOS E ESTATÍSTICAS ===
  calculateStats() {
    const total = this.state.trades.length;
    if (total === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        totalProfit: 0,
        totalROI: 0,
        totalBalance: this.state.initialBalance,
        nextTradeValue: this.state.initialTradeValue
      };
    }

    const wins = this.state.trades.filter(t => t.type === 'profit').length;
    const winRate = (wins / total) * 100;
    const totalProfit = this.state.trades.reduce((sum, t) => sum + (t.result || 0), 0);
    const totalROI = this.state.initialBalance > 0 ? (totalProfit / this.state.initialBalance) * 100 : 0;
    const totalBalance = this.state.initialBalance - this.state.initialTradeValue + this.state.currentTradeValue + totalProfit;

    return {
      totalTrades: total,
      winRate: winRate,
      totalProfit: totalProfit,
      totalROI: totalROI,
      totalBalance: totalBalance,
      nextTradeValue: this.state.currentTradeValue
    };
  },

  calculateTrends() {
    if (this.state.trades.length < 2) {
      return {
        balanceTrend: '',
        winRateTrend: '',
        profitTrend: ''
      };
    }

    const recent = this.state.trades.slice(-5);
    const older = this.state.trades.slice(-10, -5);

    if (older.length === 0) return { balanceTrend: '', winRateTrend: '', profitTrend: '' };

    const recentWinRate = (recent.filter(t => t.type === 'profit').length / recent.length) * 100;
    const olderWinRate = (older.filter(t => t.type === 'profit').length / older.length) * 100;

    const recentProfit = recent.reduce((sum, t) => sum + t.result, 0);
    const olderProfit = older.reduce((sum, t) => sum + t.result, 0);

    return {
      balanceTrend: recentProfit > olderProfit ? 'up' : 'down',
      winRateTrend: recentWinRate > olderWinRate ? 'up' : 'down',
      profitTrend: recentProfit > 0 ? 'up' : 'down'
    };
  },

  // === RENDERIZAÇÃO ===
  render() {
    const stats = this.calculateStats();
    const trends = this.calculateTrends();

    // Atualizar cards de estatísticas
    document.getElementById('totalTrades').textContent = stats.totalTrades;
    document.getElementById('winRate').textContent = this.formatPercent(stats.winRate);
    document.getElementById('totalProfit').textContent = this.formatMoney(stats.totalProfit);
    document.getElementById('totalROI').textContent = this.formatPercent(stats.totalROI);
    document.getElementById('nextTradeValue').textContent = this.formatMoney(stats.nextTradeValue);
    document.getElementById('totalBalance').textContent = this.formatMoney(stats.totalBalance);

    // Atualizar trends
    this.updateTrend('totalBalanceTrend', trends.balanceTrend);
    this.updateTrend('winRateTrend', trends.winRateTrend);
    this.updateTrend('totalProfitTrend', trends.profitTrend);

    // Renderizar tabela
    this.renderTable();
  },

  updateTrend(elementId, trend) {
    const element = document.getElementById(elementId);
    if (!element) return;

    element.className = `trend ${trend}`;
    if (trend === 'up') {
      element.textContent = '↗️ Subindo';
    } else if (trend === 'down') {
      element.textContent = '↘️ Descendo';
    } else {
      element.textContent = '';
    }
  },

  renderTable() {
    const tbody = document.getElementById('tradesBody');
    const emptyState = document.getElementById('emptyState');

    if (this.state.filteredTrades.length === 0) {
      tbody.innerHTML = '';
      if (this.state.trades.length === 0) {
        emptyState.style.display = 'block';
      } else {
        emptyState.style.display = 'none';
        tbody.innerHTML = `
          <tr>
            <td colspan="10" style="text-align: center; padding: 40px; color: var(--gray-500);">
              Nenhum trade encontrado com os filtros aplicados.
              <button class="btn btn-secondary" onclick="app.clearFilters()" style="margin-left: 12px;">
                Limpar Filtros
              </button>
            </td>
          </tr>
        `;
      }
      return;
    }

    emptyState.style.display = 'none';
    tbody.innerHTML = '';

    this.state.filteredTrades.forEach((trade, index) => {
      const tr = document.createElement('tr');
      tr.className = 'fade-in';
      tr.style.animationDelay = `${index * 50}ms`;

      const signedPct = trade.type === 'loss' ? -Number(trade.percent || 0) : Number(trade.percent || 0);
      const resultClass = trade.type === 'profit' ? 'profit' : 'loss';
      const positionDisplay = (trade.position || '').toUpperCase();
      const resultDisplay = trade.type === 'profit' ? 'Lucro' : 'Prejuízo';

      tr.innerHTML = `
        <td>${this.formatDate(trade.trade_date)}</td>
        <td><strong>${trade.pair || ''}</strong></td>
        <td>${this.formatMoney(trade.value_trade)}</td>
        <td>
          <span class="badge badge-${trade.position}">${positionDisplay}</span>
        </td>
        <td>
          <span class="${resultClass}">${resultDisplay}</span>
        </td>
        <td><strong>${signedPct.toFixed(2)}%</strong></td>
        <td class="${resultClass}"><strong>${this.formatMoney(trade.result)}</strong></td>
        <td>${this.formatMoney(trade.new_value)}</td>
        <td title="${trade.observations || ''}">${this.truncateText(trade.observations || '', 30)}</td>
        <td>
          <button class="btn btn-danger btn-sm" 
                  onclick="removeTrade(${trade.id})" 
                  aria-label="Remover trade"
                  title="Remover este trade">
            🗑️
          </button>
        </td>
      `;

      tbody.appendChild(tr);
    });
  },

  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },

  clearFilters() {
    document.getElementById('searchTrades').value = '';
    document.getElementById('filterType').value = '';
    document.getElementById('filterPosition').value = '';
    this.applyFilters();
  },

  // === SISTEMA DE GRÁFICOS ===
  createCharts() {
    this.createBalanceChart();
    this.createResultsChart();
  },

  createBalanceChart() {
    const ctx = document.getElementById('balanceChart');
    if (!ctx) return;

    this.destroyChart('balance');

    if (this.state.trades.length === 0) {
      ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
      return;
    }

    const data = this.prepareBalanceChartData();
    
    this.charts.balance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [{
          label: 'Evolução da Banca',
          data: data.values,
          borderColor: 'var(--primary-color)',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          borderWidth: 3,
          fill: true,
          tension: 0.4,
          pointBackgroundColor: 'var(--primary-color)',
          pointBorderColor: '#fff',
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: false,
            ticks: {
              callback: (value) => this.formatMoney(value)
            }
          },
          x: {
            ticks: {
              maxTicksLimit: 10
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        }
      }
    });
  },

  createResultsChart() {
    const ctx = document.getElementById('resultsChart');
    if (!ctx) return;

    this.destroyChart('results');

    if (this.state.trades.length === 0) {
      ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
      return;
    }

    const data = this.prepareResultsChartData();
    
    this.charts.results = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Lucros', 'Prejuízos'],
        datasets: [{
          data: [data.profits, data.losses],
          backgroundColor: [
            'var(--success-color)',
            'var(--danger-color)'
          ],
          borderWidth: 0,
          hoverOffset: 10
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true
            }
          }
        }
      }
    });
  },

  prepareBalanceChartData() {
    const labels = [];
    const values = [];
    let currentBalance = this.state.initialBalance - this.state.initialTradeValue;

    // Ponto inicial
    labels.push('Início');
    values.push(currentBalance + this.state.initialTradeValue);

    // Cada trade
    this.state.trades.forEach(trade => {
      currentBalance += trade.new_value - (values.length > 1 ? 
        this.state.trades[values.length - 2]?.new_value || this.state.initialTradeValue : 
        this.state.initialTradeValue) + trade.result;
      
      labels.push(this.formatDate(trade.trade_date));
      values.push(currentBalance);
    });

    return { labels, values };
  },

  prepareResultsChartData() {
    const profits = this.state.trades.filter(t => t.type === 'profit').length;
    const losses = this.state.trades.filter(t => t.type === 'loss').length;

    return { profits, losses };
  },

  updateCharts() {
    this.createCharts();
  },

  destroyChart(chartName) {
    if (this.charts[chartName]) {
      this.charts[chartName].destroy();
      this.charts[chartName] = null;
    }
  },

  destroyCharts() {
    Object.keys(this.charts).forEach(chartName => {
      this.destroyChart(chartName);
    });
  }

});
