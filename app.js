// PayTracker Core Application Logic
class PayTrackerApp {
  constructor() {
    this.selectedCategory = 'Groceries';
    this.salary = parseFloat(localStorage.getItem('paytracker_salary')) || 0;
    this.transactions = JSON.parse(localStorage.getItem('paytracker_transactions')) || [];
    this.ipoList = JSON.parse(localStorage.getItem('paytracker_ipoList')) || [];
    const DEFAULT_SHEET_URL = 'https://script.google.com/macros/s/AKfycbx_Default/exec';
    const DEFAULT_SUPABASE_URL = 'https://qhujytjjpgwovpzeierr.supabase.co';
    const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFodWp5dGpqcGd3b3ZwemVpZXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MjMxNzcsImV4cCI6MjEwMTM5OTE3N30.z5Gqh6YHQXK5GsAVNypfzBO3Gnz51mNNBno8vfvQ52s';

    this.googleScriptUrl = localStorage.getItem('paytracker_googleScriptUrl') || DEFAULT_SHEET_URL;
    this.supabaseUrl = localStorage.getItem('paytracker_supabaseUrl') || DEFAULT_SUPABASE_URL;
    this.supabaseKey = localStorage.getItem('paytracker_supabaseKey') || DEFAULT_SUPABASE_KEY;
    this.offlineQueue = JSON.parse(localStorage.getItem('paytracker_offlineQueue')) || [];

    this.supabaseClient = null;
    this.initSupabaseClient();

    this.pieChart = null;
    this.barChart = null;

    this.init();
  }

  sanitizeSupabaseUrl(url) {
    if (!url) return '';
    let cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }
    try {
      const parsed = new URL(cleanUrl);
      cleanUrl = parsed.origin;
    } catch (e) {
      cleanUrl = cleanUrl.replace(/\/+$/, '');
    }
    return cleanUrl;
  }

  initSupabaseClient() {
    const cleanUrl = this.sanitizeSupabaseUrl(this.supabaseUrl);
    const cleanKey = (this.supabaseKey || '').trim();

    if (cleanUrl && cleanKey && typeof supabase !== 'undefined') {
      try {
        this.supabaseClient = supabase.createClient(cleanUrl, cleanKey);
        this.fetchAppConfigFromSupabase();
      } catch (err) {
        console.warn('Supabase initialization failed:', err);
      }
    }
  }

  async fetchAppConfigFromSupabase() {
    if (!this.supabaseClient) return;
    try {
      const { data, error } = await this.supabaseClient.from('app_config').select('*').eq('config_key', 'google_sheet_url').single();
      if (!error && data && data.config_value) {
        this.googleScriptUrl = data.config_value;
        localStorage.setItem('paytracker_googleScriptUrl', data.config_value);
        const urlInput = document.getElementById('googleSheetScriptUrl');
        if (urlInput) urlInput.value = data.config_value;
      }
    } catch (e) {
      console.warn('App config fetch error:', e);
    }
  }

  async saveAppConfigToSupabase(key, value) {
    if (!this.supabaseClient) return;
    try {
      await this.supabaseClient.from('app_config').upsert([{ config_key: key, config_value: value, updated_at: new Date().toISOString() }]);
    } catch (e) {
      console.warn('App config upsert error:', e);
    }
  }

  // --- Cryptographic SHA-256 Hashing ---
  async hashPIN(pinText) {
    const encoder = new TextEncoder();
    const data = encoder.encode('DISHIV_SALT_V2_' + pinText);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  init() {
    this.renderHeaderAndMetrics();
    this.renderHistory();
    this.renderIPOList();
    this.loadSettings();
    this.checkSyncStatus();

    // Register Service Worker for PWA if running on HTTP/HTTPS
    if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
      navigator.serviceWorker.register('./sw.js').catch(err => console.log('SW registration skipped for local file protocol'));
    }
  }

  // --- Category Selection ---
  selectCategory(categoryName, element) {
    this.selectedCategory = categoryName;
    document.querySelectorAll('.category-badge').forEach(el => el.classList.remove('active'));
    if (element) {
      element.classList.add('active');
    }
  }

  setAmount(val) {
    const input = document.getElementById('entryAmount');
    const current = parseFloat(input.value) || 0;
    input.value = current + val;
  }

  // --- Metrics Calculation ---
  renderHeaderAndMetrics() {
    // Display active logged-in user & role badge
    if (typeof auth !== 'undefined') {
      const currentUser = auth.getCurrentUser();
      const currentRole = auth.isOwner() ? '👑 Owner' : '👤 User';
      const userSubEl = document.getElementById('userProfileSub');
      if (userSubEl) {
        userSubEl.innerHTML = `Logged in as: <strong>${currentUser}</strong> (${currentRole})`;
      }
    }

    // Calculate total spent (excluding IPO blocked/refunded, only active expenses)
    const totalSpent = this.transactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
    
    // Total blocked in IPOs
    const blockedInIPO = this.ipoList
      .filter(item => item.status === 'Blocked')
      .reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

    const netSpentAndBlocked = totalSpent + blockedInIPO;
    const remainingBalance = this.salary - netSpentAndBlocked;

    document.getElementById('totalSpentDisplay').innerText = `₹${totalSpent.toLocaleString('en-IN')}`;
    document.getElementById('remainingBalanceDisplay').innerText = `₹${remainingBalance.toLocaleString('en-IN')}`;

    // Calculate Daily Safe-to-Spend limit
    const now = new Date();
    const totalDaysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = Math.max(1, totalDaysInMonth - now.getDate() + 1);
    const dailyLimit = remainingBalance > 0 ? Math.floor(remainingBalance / daysRemaining) : 0;

    document.getElementById('dailyLimitDisplay').innerText = `₹${dailyLimit.toLocaleString('en-IN')}/day`;

    // Progress bar
    const progressPct = this.salary > 0 ? Math.min(100, Math.round((netSpentAndBlocked / this.salary) * 100)) : 0;
    document.getElementById('progressBarFill').style.width = `${progressPct}%`;
    document.getElementById('progressPercentageText').innerText = `${progressPct}% Spent`;

    // Over-spending Alert Banner
    const alertBanner = document.getElementById('alertBanner');
    if (progressPct >= 80 && this.salary > 0) {
      alertBanner.classList.remove('hidden');
      document.getElementById('alertBannerText').innerText = `Warning: You have used ${progressPct}% of your monthly salary! (${daysRemaining} days left)`;
    } else {
      alertBanner.classList.add('hidden');
    }

    // IPO Badge Count
    const activeIpoCount = this.ipoList.filter(item => item.status === 'Blocked').length;
    document.getElementById('ipoBadgeCount').innerText = activeIpoCount;

    // Save state
    localStorage.setItem('paytracker_salary', this.salary);
    localStorage.setItem('paytracker_transactions', JSON.stringify(this.transactions));
    localStorage.setItem('paytracker_ipoList', JSON.stringify(this.ipoList));
  }

  // --- Handle New Entry ---
  async handleAddEntry(event) {
    event.preventDefault();
    const amountInput = document.getElementById('entryAmount');
    const amount = parseFloat(amountInput.value);
    const paymentMethod = document.getElementById('entryPaymentMethod').value;
    const notes = document.getElementById('entryNotes').value.trim();

    if (!amount || amount <= 0) {
      alert('Please enter a valid amount!');
      return;
    }

    const newTx = {
      id: 'TX-' + Date.now(),
      datetime: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
      type: 'Expense',
      category: this.selectedCategory,
      amount: amount,
      paymentMethod: paymentMethod,
      notes: notes || `${this.selectedCategory} via ${paymentMethod}`,
      loggedBy: typeof auth !== 'undefined' ? auth.getCurrentUser() : 'Disha & Shivdattsinh',
      status: 'Completed'
    };

    // If category is IPO, also add to IPO tracker automatically
    if (this.selectedCategory === 'IPO') {
      const ipoItem = {
        id: 'IPO-' + Date.now(),
        name: notes || 'IPO Application',
        amount: amount,
        paymentMethod: paymentMethod,
        date: new Date().toLocaleDateString('en-IN'),
        status: 'Blocked' // Initial status
      };
      this.ipoList.unshift(ipoItem);
      this.renderIPOList();
    } else {
      this.transactions.unshift(newTx);
    }

    // Reset Form
    amountInput.value = '';
    document.getElementById('entryNotes').value = '';

    // Re-render UI
    this.renderHeaderAndMetrics();
    this.renderHistory();

    // Trigger Google Sheet Sync & Supabase Cloud DB Sync
    await this.syncTransactionToSheet(newTx);
    await this.saveTransactionToSupabase(newTx);
  }

  async saveTransactionToSupabase(txItem) {
    if (!this.supabaseClient) return;
    try {
      await this.supabaseClient.from('transactions').insert([{
        id: txItem.id,
        datetime: txItem.datetime,
        type: txItem.type,
        category: txItem.category,
        amount: txItem.amount,
        payment_method: txItem.paymentMethod,
        notes: txItem.notes,
        logged_by: txItem.loggedBy,
        status: txItem.status
      }]);
    } catch (err) {
      console.warn('Supabase transaction insert error:', err);
    }
  }

  // --- Google Sheet Syncing ---
  async syncTransactionToSheet(txItem) {
    if (!this.googleScriptUrl) {
      // Add to offline queue
      this.queueOffline(txItem);
      return;
    }

    try {
      this.setSyncStatus('syncing', 'Syncing...');
      const response = await fetch(this.googleScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(txItem)
      });
      const data = await response.json();

      if (data.result === 'success') {
        this.setSyncStatus('online', 'Sheet Synced');
      } else {
        this.queueOffline(txItem);
        this.setSyncStatus('offline', 'Sheet Pending');
      }
    } catch (err) {
      console.warn('Sync failed, queued offline:', err);
      this.queueOffline(txItem);
      this.setSyncStatus('offline', 'Sheet Pending');
    }
  }

  queueOffline(item) {
    this.offlineQueue.push(item);
    localStorage.setItem('paytracker_offlineQueue', JSON.stringify(this.offlineQueue));
  }

  async syncPendingData() {
    if (!this.googleScriptUrl) {
      alert('Please set your Google Apps Script Web App URL in the Sync tab first!');
      this.switchTab('settingsTab', document.querySelectorAll('.tab-btn')[3]);
      return;
    }

    if (this.offlineQueue.length === 0) {
      alert('All transactions are already synced to Google Sheet!');
      return;
    }

    try {
      this.setSyncStatus('syncing', 'Syncing Queue...');
      const response = await fetch(this.googleScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(this.offlineQueue)
      });
      const data = await response.json();

      if (data.result === 'success') {
        alert(`Successfully synced ${this.offlineQueue.length} pending entries to Google Sheet!`);
        this.offlineQueue = [];
        localStorage.setItem('paytracker_offlineQueue', JSON.stringify(this.offlineQueue));
        this.setSyncStatus('online', 'Sheet Synced');
      }
    } catch (err) {
      alert('Could not sync to Google Sheet. Check URL or internet connection.');
      this.setSyncStatus('offline', 'Sheet Pending');
    }
  }

  setSyncStatus(status, text) {
    const badge = document.getElementById('syncStatusBadge');
    const textEl = document.getElementById('syncText');
    badge.className = `sync-badge ${status}`;
    textEl.innerText = text;
  }

  checkSyncStatus() {
    if (!this.googleScriptUrl) {
      this.setSyncStatus('offline', 'Sheet Unlinked');
    } else if (this.offlineQueue.length > 0) {
      this.setSyncStatus('offline', `${this.offlineQueue.length} Pending`);
    } else {
      this.setSyncStatus('online', 'Sheet Ready');
    }
  }

  // --- Render Transaction History ---
  renderHistory() {
    const historyList = document.getElementById('historyList');
    const filter = document.getElementById('categoryFilter').value;

    let items = this.transactions;
    if (filter !== 'ALL') {
      items = items.filter(tx => tx.category === filter);
    }

    if (items.length === 0) {
      historyList.innerHTML = `<div class="empty-state">No transactions recorded yet.<br>Add your first entry above!</div>`;
      return;
    }

    const catIcons = {
      'Groceries': '🛒',
      'Petrol': '⛽',
      'Shopping': '🛍️',
      'Transfer to Husband': '📱',
      'Gas & Bills': '⚡',
      'IPO': '📈',
      'Food & Dining': '🍔',
      'Others': '💵'
    };

    historyList.innerHTML = items.map(tx => `
      <div class="tx-item">
        <div class="tx-left">
          <div class="tx-icon">${catIcons[tx.category] || '💸'}</div>
          <div class="tx-details">
            <h4>${tx.category}</h4>
            <div class="tx-meta">
              <span>${tx.datetime}</span> • <span>${tx.paymentMethod}</span>
              ${tx.notes ? ` • <span>${tx.notes}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="tx-right">
          <span class="tx-amount">-₹${tx.amount.toLocaleString('en-IN')}</span>
          <button class="tx-delete-btn" onclick="app.deleteTransaction('${tx.id}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
    `).join('');
  }

  deleteTransaction(txId) {
    if (confirm('Delete this transaction entry?')) {
      this.transactions = this.transactions.filter(tx => tx.id !== txId);
      this.renderHeaderAndMetrics();
      this.renderHistory();
    }
  }

  // --- IPO Tracker Logic ---
  quickAddIPO() {
    const name = prompt('Enter IPO Name (e.g. Tata Tech IPO):');
    if (!name) return;
    const amountStr = prompt('Enter Blocked Amount (₹):', '15000');
    const amount = parseFloat(amountStr);
    if (!amount) return;

    const ipoItem = {
      id: 'IPO-' + Date.now(),
      name: name,
      amount: amount,
      paymentMethod: 'Netbanking (ASBA)',
      date: new Date().toLocaleDateString('en-IN'),
      status: 'Blocked'
    };

    this.ipoList.unshift(ipoItem);
    this.renderHeaderAndMetrics();
    this.renderIPOList();

    // Sync to sheet
    this.syncTransactionToSheet({
      id: ipoItem.id,
      datetime: ipoItem.date,
      type: 'IPO Application',
      category: 'IPO',
      amount: amount,
      paymentMethod: 'NetBanking',
      notes: name,
      status: 'Blocked'
    });
  }

  updateIPOStatus(ipoId, newStatus) {
    const item = this.ipoList.find(i => i.id === ipoId);
    if (item) {
      item.status = newStatus;
      this.renderHeaderAndMetrics();
      this.renderIPOList();
    }
  }

  deleteIPO(ipoId) {
    if (confirm('Remove this IPO entry?')) {
      this.ipoList = this.ipoList.filter(i => i.id !== ipoId);
      this.renderHeaderAndMetrics();
      this.renderIPOList();
    }
  }

  renderIPOList() {
    const ipoListEl = document.getElementById('ipoList');

    const blockedTotal = this.ipoList.filter(i => i.status === 'Blocked').reduce((a, b) => a + b.amount, 0);
    const allottedTotal = this.ipoList.filter(i => i.status === 'Allotted').reduce((a, b) => a + b.amount, 0);
    const refundedTotal = this.ipoList.filter(i => i.status === 'Refunded').reduce((a, b) => a + b.amount, 0);

    document.getElementById('ipoBlockedAmount').innerText = `₹${blockedTotal.toLocaleString('en-IN')}`;
    document.getElementById('ipoAllottedAmount').innerText = `₹${allottedTotal.toLocaleString('en-IN')}`;
    document.getElementById('ipoRefundedAmount').innerText = `₹${refundedTotal.toLocaleString('en-IN')}`;

    if (this.ipoList.length === 0) {
      ipoListEl.innerHTML = `<div class="empty-state">No IPO applications tracked yet.<br>Click "+ New IPO" to add one!</div>`;
      return;
    }

    ipoListEl.innerHTML = this.ipoList.map(item => `
      <div class="ipo-item">
        <div class="ipo-header">
          <div>
            <h4>📈 ${item.name}</h4>
            <div class="tx-meta">Applied on ${item.date} • ${item.paymentMethod}</div>
          </div>
          <span class="status-badge ${item.status.toLowerCase()}">${item.status}</span>
        </div>
        <div class="ipo-header">
          <strong style="font-size: 16px;">₹${item.amount.toLocaleString('en-IN')}</strong>
          <div class="ipo-actions">
            ${item.status === 'Blocked' ? `
              <button class="secondary-btn" style="padding:4px 8px; font-size:11px;" onclick="app.updateIPOStatus('${item.id}', 'Allotted')">🎉 Allotted</button>
              <button class="secondary-btn" style="padding:4px 8px; font-size:11px;" onclick="app.updateIPOStatus('${item.id}', 'Refunded')">↩️ Refunded</button>
            ` : ''}
            <button class="tx-delete-btn" onclick="app.deleteIPO('${item.id}')"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      </div>
    `).join('');
  }

  // --- Analytics Charts & Couple Comparison ---
  renderCharts() {
    // 1. Pie Chart (Category Breakdown)
    const categories = ['Groceries', 'Petrol', 'Shopping', 'Transfer to Husband', 'Gas & Bills', 'Food & Dining', 'Others'];
    const dataByCat = categories.map(cat => {
      return this.transactions.filter(tx => tx.category === cat).reduce((sum, tx) => sum + tx.amount, 0);
    });

    const ctxPie = document.getElementById('categoryPieChart').getContext('2d');
    if (this.pieChart) this.pieChart.destroy();

    this.pieChart = new Chart(ctxPie, {
      type: 'doughnut',
      data: {
        labels: categories,
        datasets: [{
          data: dataByCat,
          backgroundColor: ['#10b981', '#f59e0b', '#ec4899', '#6366f1', '#3b82f6', '#8b5cf6', '#64748b']
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans' } } }
        }
      }
    });

    // 2. Dynamic Multi-User Spending Comparison Chart
    const ctxBar = document.getElementById('dailyBarChart').getContext('2d');
    if (this.barChart) this.barChart.destroy();

    // Group expenses dynamically by loggedBy user
    const userTotals = {};
    this.transactions.forEach(tx => {
      const user = tx.loggedBy || 'Disha (Owner)';
      userTotals[user] = (userTotals[user] || 0) + parseFloat(tx.amount || 0);
    });

    const userLabels = Object.keys(userTotals).length > 0 ? Object.keys(userTotals) : ['dishiv (Owner)', 'shiv (User)'];
    const userAmounts = userLabels.map(u => userTotals[u] || 0);
    const colorPalette = ['#ec4899', '#6366f1', '#10b981', '#f59e0b', '#8b5cf6', '#3b82f6'];

    this.barChart = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: userLabels,
        datasets: [{
          label: 'Total Expenses Logged This Month (₹)',
          data: userAmounts,
          backgroundColor: userLabels.map((_, i) => colorPalette[i % colorPalette.length]),
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        scales: {
          x: { ticks: { color: '#94a3b8' } },
          y: { ticks: { color: '#94a3b8' } }
        },
        plugins: {
          legend: { labels: { color: '#94a3b8' } }
        }
      }
    });
  }

  // --- Tabs Navigation ---
  switchTab(tabId, btnElement) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    document.getElementById(tabId).classList.remove('hidden');
    if (btnElement) btnElement.classList.add('active');

    if (tabId === 'analyticsTab') {
      this.renderCharts();
    }
  }

  // --- Salary Modal Handlers ---
  closeSalaryModal() {
    document.getElementById('salaryModal').classList.add('hidden');
  }

  saveSalaryFromModal() {
    const val = parseFloat(document.getElementById('salaryInputModal').value);
    if (!isNaN(val) && val >= 0) {
      this.salary = val;
      this.renderHeaderAndMetrics();
      this.closeSalaryModal();
    }
  }

  // --- Modal & Settings & Role Restrictions ---
  openSalaryModal() {
    if (typeof auth !== 'undefined' && typeof auth.isOwner === 'function' && !auth.isOwner()) {
      alert('🔒 Access Restricted: Only Owner (Disha) can edit monthly salary!');
      return;
    }
    document.getElementById('salaryInputModal').value = this.salary || '';
    document.getElementById('salaryModal').classList.remove('hidden');
  }

  loadSettings() {
    const urlInput = document.getElementById('googleSheetScriptUrl');
    urlInput.value = this.googleScriptUrl;

    const subUrlInput = document.getElementById('supabaseUrlInput');
    const subKeyInput = document.getElementById('supabaseKeyInput');
    if (subUrlInput) subUrlInput.value = this.supabaseUrl;
    if (subKeyInput) subKeyInput.value = this.supabaseKey;

    if (typeof auth !== 'undefined' && typeof auth.isOwner === 'function' && !auth.isOwner()) {
      // USER Role Restrictions: Cannot unlink or edit sheet settings
      urlInput.disabled = true;
      urlInput.placeholder = '🔒 Linked by Owner (Disha)';
      if (subUrlInput) subUrlInput.disabled = true;
      if (subKeyInput) subKeyInput.disabled = true;

      const saveBtns = document.querySelectorAll('#settingsTab .primary-btn');
      saveBtns.forEach(btn => btn.style.display = 'none');
    }

    fetch('./google_apps_script.js')
      .then(res => res.text())
      .then(text => {
        document.getElementById('appsScriptCodeSnippet').innerText = text;
      })
      .catch(() => {
        document.getElementById('appsScriptCodeSnippet').innerText = 'Apps Script snippet file available in workspace.';
      });

    // Schedule 8:30 PM Evening Reminder
    this.scheduleEveningReminder();

    // Load Owner Audit Logs if Owner
    this.loadAuditLogs();
  }

  async loadAuditLogs() {
    const auditSection = document.getElementById('ownerAuditSection');
    const auditList = document.getElementById('auditLogsList');

    if (typeof auth !== 'undefined' && !auth.isOwner()) {
      if (auditSection) auditSection.style.display = 'none';
      return;
    }

    if (auditSection) auditSection.style.display = 'flex';

    let logs = [];
    if (this.supabaseClient) {
      try {
        const { data, error } = await this.supabaseClient
          .from('audit_logs')
          .select('*')
          .order('logged_at', { ascending: false })
          .limit(30);

        if (!error && data) logs = data;
      } catch (e) {
        console.warn('Could not fetch Supabase audit logs:', e);
      }
    }

    if (logs.length === 0) {
      logs = JSON.parse(localStorage.getItem('dishiv_audit_logs') || '[]');
    }

    if (logs.length === 0) {
      if (auditList) auditList.innerHTML = `<div class="empty-state">No audit logs recorded yet.</div>`;
      return;
    }

    if (auditList) {
      auditList.innerHTML = logs.map(log => `
        <div class="tx-item">
          <div class="tx-left">
            <div class="tx-icon">${log.action === 'USER_LOGIN' ? '🔐' : '🔑'}</div>
            <div class="tx-details">
              <h4>${log.username} (${log.role || 'USER'})</h4>
              <div class="tx-meta">
                <span>${new Date(log.logged_at).toLocaleString('en-IN')}</span> • <span>${log.device_type || 'Device'}</span>
              </div>
            </div>
          </div>
          <div class="tx-right">
            <span class="status-badge ${log.action === 'USER_LOGIN' ? 'allotted' : 'refunded'}">${log.action}</span>
          </div>
        </div>
      `).join('');
    }
  }

  saveSupabaseSettings() {
    if (typeof auth !== 'undefined' && typeof auth.isOwner === 'function' && !auth.isOwner()) {
      alert('🔒 Access Restricted: Only Owner (Disha) can modify Supabase Cloud DB settings!');
      return;
    }
    const rawUrl = document.getElementById('supabaseUrlInput').value.trim();
    const key = document.getElementById('supabaseKeyInput').value.trim();

    const cleanUrl = this.sanitizeSupabaseUrl(rawUrl);
    document.getElementById('supabaseUrlInput').value = cleanUrl;

    this.supabaseUrl = cleanUrl;
    this.supabaseKey = key;

    localStorage.setItem('paytracker_supabaseUrl', cleanUrl);
    localStorage.setItem('paytracker_supabaseKey', key);

    this.initSupabaseClient();
    alert('🎉 Supabase Cloud PostgreSQL DB settings saved successfully!');
  }

  async testSupabaseConnection() {
    if (!this.supabaseUrl || !this.supabaseKey) {
      alert('Please enter your Supabase Project URL and Anon Key first!');
      return;
    }

    try {
      this.initSupabaseClient();
      if (!this.supabaseClient) {
        alert('Supabase client could not be initialized. Check console for details.');
        return;
      }

      const { data, error } = await this.supabaseClient.from('transactions').select('id').limit(1);
      if (error) {
        alert('Supabase Connection Error: ' + error.message + '\nMake sure you executed the SQL setup script in Supabase SQL Editor!');
      } else {
        alert('🎉 Supabase Connection Successful! Connected to 24/7 Cloud DB!');
      }
    } catch (err) {
      alert('Connection failed: ' + err.toString());
    }
  }

  saveSettings() {
    if (typeof auth !== 'undefined' && typeof auth.isOwner === 'function' && !auth.isOwner()) {
      alert('🔒 Access Restricted: Only Owner (Disha) can modify Google Sheet URL settings!');
      return;
    }
    const url = document.getElementById('googleSheetScriptUrl').value.trim();
    this.googleScriptUrl = url;
    localStorage.setItem('paytracker_googleScriptUrl', url);
    this.saveAppConfigToSupabase('google_sheet_url', url);
    this.checkSyncStatus();
    alert('Google Apps Script Web App URL saved successfully to Cloud DB & Local Storage!');
  }

  // --- 8:30 PM Daily Reminder System ---
  triggerTestNotification() {
    if (!('Notification' in window)) {
      alert('⚠️ Web Notifications are not supported in your current browser!');
      return;
    }

    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification('🔔 DiShiv PayTracker Reminder (Test Success)', {
          body: 'Did you make any GPay, PhonePe or Paytm payment today? Tap to record it in 2 seconds!',
          icon: 'https://cdn-icons-png.flaticon.com/512/2845/2845722.png'
        });
        alert('🎉 Test Notification Triggered! Check your mobile/screen notification bar!');
      } else {
        alert('⚠️ Notification permission was blocked/denied! Please allow notifications in your browser site settings.');
      }
    });
  }

  scheduleEveningReminder() {
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
      Notification.requestPermission();
    }

    // Check time periodically
    setInterval(() => {
      const now = new Date();
      // 8:30 PM = 20:30
      if (now.getHours() === 20 && now.getMinutes() === 30 && now.getSeconds() === 0) {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🔔 DiShiv PayTracker Evening Reminder', {
            body: 'Did you make any GPay, PhonePe or Paytm payment today? Tap to record it in 2 seconds!',
            icon: 'https://cdn-icons-png.flaticon.com/512/2845/2845722.png'
          });
        }
      }
    }, 1000);
  }

  async testGoogleSheetConnection() {
    if (!this.googleScriptUrl) {
      alert('Please enter your Web App URL first!');
      return;
    }

    try {
      const testItem = {
        id: 'TEST-' + Date.now(),
        datetime: new Date().toLocaleString('en-IN'),
        type: 'Test Connection',
        category: 'Test',
        amount: 1,
        paymentMethod: 'Test',
        notes: 'Test sync connection from PayTracker App',
        status: 'Success'
      };

      const res = await fetch(this.googleScriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(testItem)
      });
      const data = await res.json();

      if (data.result === 'success') {
        alert('🎉 Connection Successful! A test row has been appended to your Google Sheet!');
        this.setSyncStatus('online', 'Sheet Connected');
      } else {
        alert('Sync error: ' + JSON.stringify(data));
      }
    } catch (err) {
      alert('Connection failed: ' + err.toString() + '\nMake sure Web App is deployed with "Anyone" access.');
    }
  }

  copyAppsScriptCode() {
    const code = document.getElementById('appsScriptCodeSnippet').innerText;
    navigator.clipboard.writeText(code).then(() => {
      alert('Apps Script code copied to clipboard!');
    });
  }

  exportCSV() {
    if (this.transactions.length === 0) {
      alert('No data to export!');
      return;
    }

    let csvContent = 'data:text/csv;charset=utf-8,ID,Date,Category,Amount,PaymentMethod,Notes\n';
    this.transactions.forEach(tx => {
      csvContent += `"${tx.id}","${tx.datetime}","${tx.category}",${tx.amount},"${tx.paymentMethod}","${tx.notes}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PayTracker_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  clearAllData() {
    if (confirm('Are you sure you want to reset all local tracker data? (Google Sheet data will remain safe)')) {
      localStorage.clear();
      location.reload();
    }
  }
}

// Instantiate App
const app = new PayTrackerApp();
