// Main DiShiv PayTracker Orchestrator (100% Dynamic REST API Driven)
class PayTrackerApp {
  constructor() {
    this.selectedCategory = 'Groceries';
    this.salary = 0;
    this.transactions = [];
    this.ipoList = [];
    this.googleScriptUrl = '';

    this.pieChart = null;
    this.barChart = null;

    this.init();
  }

  async init() {
    // 1. Check auth
    if (typeof auth !== 'undefined') {
      auth.requireAuth();
    }

    // 2. Fetch App Config & Google Sheet URL from DB API
    const sheetUrlFromDB = await budgetService.fetchConfig('google_sheet_url');
    if (sheetUrlFromDB) {
      this.googleScriptUrl = sheetUrlFromDB;
      const urlInput = document.getElementById('googleSheetScriptUrl');
      if (urlInput) urlInput.value = sheetUrlFromDB;
    }

    // 3. Fetch Salary from DB API
    this.salary = await budgetService.fetchSalary();

    // 4. Fetch Transactions from DB API
    this.transactions = await transactionService.fetchAll();

    // 5. Fetch IPO Applications from DB API
    this.ipoList = await ipoService.fetchAll();

    // 6. Render UI
    this.renderHeaderAndMetrics();
    this.renderHistory();
    this.renderIPOTable();

    // 7. Load settings
    this.loadSettings();

    // 8. Register Service Worker
    this.registerServiceWorker();
  }

  // --- Category Selector ---
  selectCategory(catName, btnElement) {
    this.selectedCategory = catName;
    document.querySelectorAll('.cat-chip').forEach(el => el.classList.remove('active'));
    if (btnElement) {
      btnElement.classList.add('active');
    }
  }

  // --- Fast Numpad Helper ---
  appendNumpad(val) {
    const input = document.getElementById('txAmount');
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

    document.getElementById('salaryDisplay').innerText = `₹${this.salary.toLocaleString('en-IN')}`;

    // Calculate total spent
    const totalSpent = this.transactions.reduce((sum, tx) => sum + parseFloat(tx.amount || 0), 0);
    const balance = this.salary - totalSpent;

    document.getElementById('totalExpenseDisplay').innerText = `₹${totalSpent.toLocaleString('en-IN')}`;
    document.getElementById('balanceDisplay').innerText = `₹${balance.toLocaleString('en-IN')}`;

    const balanceCard = document.getElementById('balanceCard');
    if (balance < 0) {
      balanceCard.style.borderColor = '#ef4444';
    } else {
      balanceCard.style.borderColor = 'rgba(255, 255, 255, 0.08)';
    }

    // 50-30-20 Envelope Metrics
    const needsBudget = this.salary * 0.50;
    const investmentsBudget = this.salary * 0.20;
    const wantsBudget = this.salary * 0.30;

    const needsEl = document.getElementById('envNeedsDisplay');
    const invEl = document.getElementById('envInvestmentsDisplay');
    const wantsEl = document.getElementById('envWantsDisplay');

    if (needsEl) needsEl.innerText = `₹${needsBudget.toLocaleString('en-IN')}`;
    if (invEl) invEl.innerText = `₹${investmentsBudget.toLocaleString('en-IN')}`;
    if (wantsEl) wantsEl.innerText = `₹${wantsBudget.toLocaleString('en-IN')}`;
  }

  // --- Transaction History ---
  renderHistory() {
    const listContainer = document.getElementById('txHistoryList');
    if (!listContainer) return;

    if (this.transactions.length === 0) {
      listContainer.innerHTML = `<div class="empty-state">No payment entries recorded yet.</div>`;
      return;
    }

    const iconMap = {
      'Groceries': '🛒',
      'IPO Application': '📈',
      'Petrol / Fuel': '⛽',
      'Gas Cylinder': '🔥',
      'Shopping & Clothes': '🛍️',
      'Mobile Transfer to Husband': '📲',
      'Electricity / Bills': '💡',
      'Food & Dining': '🍔',
      'Medical & Health': '💊',
      'General / Other': '💸'
    };

    listContainer.innerHTML = this.transactions.map(tx => `
      <div class="tx-item">
        <div class="tx-left">
          <div class="tx-icon">${iconMap[tx.category] || '💸'}</div>
          <div class="tx-details">
            <h4>${tx.category}</h4>
            <div class="tx-meta">
              <span>${tx.datetime}</span> • <span>${tx.paymentMethod}</span> ${tx.notes ? `• <em>${tx.notes}</em>` : ''}
              ${tx.loggedBy ? ` • <span style="color: #6366f1;">${tx.loggedBy}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="tx-right">
          <div class="tx-amount">- ₹${tx.amount.toLocaleString('en-IN')}</div>
          <button class="delete-tx-btn" onclick="app.deleteTransaction('${tx.id}')" title="Delete Entry">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  // --- Add Transaction ---
  async handleAddEntry() {
    const amtInput = document.getElementById('txAmount');
    const methodSelect = document.getElementById('txPaymentMethod');
    const notesInput = document.getElementById('txNotes');

    const amount = parseFloat(amtInput.value);
    if (isNaN(amount) || amount <= 0) {
      alert('Please enter a valid expense amount!');
      return;
    }

    const currentUser = (typeof auth !== 'undefined') ? auth.getCurrentUser() : 'Disha';

    const newTx = {
      id: 'TX-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      datetime: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
      type: 'Expense',
      category: this.selectedCategory,
      amount: amount,
      paymentMethod: methodSelect.value,
      notes: notesInput.value.trim(),
      loggedBy: currentUser,
      status: 'Completed'
    };

    // Save via DB API
    await transactionService.create(newTx);
    this.transactions.unshift(newTx);

    // Reset inputs
    amtInput.value = '';
    notesInput.value = '';

    // Render UI
    this.renderHeaderAndMetrics();
    this.renderHistory();

    // Trigger Google Sheet Sync
    await this.syncTransactionToSheet(newTx);
  }

  async deleteTransaction(txId) {
    if (!confirm('Are you sure you want to delete this payment record?')) return;
    await transactionService.delete(txId);
    this.transactions = this.transactions.filter(t => t.id !== txId);
    this.renderHeaderAndMetrics();
    this.renderHistory();
  }

  // --- Google Sheet Syncing ---
  async syncTransactionToSheet(txItem) {
    if (!this.googleScriptUrl) return;

    try {
      await fetch(this.googleScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(txItem)
      });
    } catch (err) {
      console.warn('Google Sheet Sync Error:', err);
    }
  }

  // --- IPO Application Manager ---
  async quickAddIPO() {
    const nameInput = document.getElementById('ipoName');
    const amtInput = document.getElementById('ipoAmount');
    const methodSelect = document.getElementById('ipoPaymentMethod');

    const name = nameInput.value.trim();
    const amount = parseFloat(amtInput.value);

    if (!name || isNaN(amount) || amount <= 0) {
      alert('Please enter valid IPO Name and Blocked Amount!');
      return;
    }

    const newIPO = {
      id: 'IPO-' + Date.now(),
      name: name,
      amount: amount,
      paymentMethod: methodSelect.value,
      date: new Date().toLocaleDateString('en-IN'),
      status: 'Blocked'
    };

    await ipoService.create(newIPO);
    this.ipoList.unshift(newIPO);

    nameInput.value = '';
    amtInput.value = '';

    this.renderIPOTable();
  }

  async updateIPOStatus(ipoId, newStatus) {
    await ipoService.updateStatus(ipoId, newStatus);
    const item = this.ipoList.find(i => i.id === ipoId);
    if (item) item.status = newStatus;
    this.renderIPOTable();
  }

  async deleteIPO(ipoId) {
    if (!confirm('Delete this IPO application record?')) return;
    await ipoService.delete(ipoId);
    this.ipoList = this.ipoList.filter(i => i.id !== ipoId);
    this.renderIPOTable();
  }

  renderIPOTable() {
    const listContainer = document.getElementById('ipoListContainer');
    if (!listContainer) return;

    if (this.ipoList.length === 0) {
      listContainer.innerHTML = `<div class="empty-state">No IPO applications recorded yet.</div>`;
      return;
    }

    listContainer.innerHTML = this.ipoList.map(ipo => `
      <div class="tx-item">
        <div class="tx-left">
          <div class="tx-icon">📈</div>
          <div class="tx-details">
            <h4>${ipo.name}</h4>
            <div class="tx-meta">
              <span>${ipo.date}</span> • <span>${ipo.paymentMethod}</span>
            </div>
          </div>
        </div>
        <div class="tx-right">
          <div class="tx-amount">₹${ipo.amount.toLocaleString('en-IN')}</div>
          <select class="status-badge ${ipo.status.toLowerCase()}" onchange="app.updateIPOStatus('${ipo.id}', this.value)">
            <option value="Blocked" ${ipo.status === 'Blocked' ? 'selected' : ''}>🔒 Blocked</option>
            <option value="Allotted" ${ipo.status === 'Allotted' ? 'selected' : ''}>🎉 Allotted</option>
            <option value="Refunded" ${ipo.status === 'Refunded' ? 'selected' : ''}>↩️ Refunded</option>
          </select>
          <button class="delete-tx-btn" onclick="app.deleteIPO('${ipo.id}')"><i class="fa-solid fa-trash-can"></i></button>
        </div>
      </div>
    `).join('');
  }

  // --- Analytics Charts ---
  renderCharts() {
    const ctxPie = document.getElementById('categoryPieChart').getContext('2d');
    if (this.pieChart) this.pieChart.destroy();

    const catTotals = {};
    this.transactions.forEach(tx => {
      catTotals[tx.category] = (catTotals[tx.category] || 0) + tx.amount;
    });

    const categories = Object.keys(catTotals);
    const dataByCat = Object.values(catTotals);

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

    // Dynamic Multi-User Spending Comparison Chart
    const ctxBar = document.getElementById('dailyBarChart').getContext('2d');
    if (this.barChart) this.barChart.destroy();

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

  async saveSalaryFromModal() {
    const val = parseFloat(document.getElementById('salaryInputModal').value);
    if (!isNaN(val) && val >= 0) {
      await budgetService.saveSalary(val);
      this.salary = val;
      this.renderHeaderAndMetrics();
      this.closeSalaryModal();
    }
  }

  openSalaryModal() {
    if (typeof auth !== 'undefined' && typeof auth.isOwner === 'function' && !auth.isOwner()) {
      alert('🔒 Access Restricted: Only Owner (Disha) can edit monthly salary!');
      return;
    }
    document.getElementById('salaryInputModal').value = this.salary || '';
    document.getElementById('salaryModal').classList.remove('hidden');
  }

  async loadSettings() {
    const urlInput = document.getElementById('googleSheetScriptUrl');
    if (urlInput) urlInput.value = this.googleScriptUrl;

    const subUrlInput = document.getElementById('supabaseUrlInput');
    const subKeyInput = document.getElementById('supabaseKeyInput');
    if (subUrlInput) subUrlInput.value = dbConfig.url;
    if (subKeyInput) subKeyInput.value = dbConfig.key;

    if (typeof auth !== 'undefined' && typeof auth.isOwner === 'function' && !auth.isOwner()) {
      if (urlInput) {
        urlInput.disabled = true;
        urlInput.placeholder = '🔒 Linked by Owner (Disha)';
      }
      if (subUrlInput) subUrlInput.disabled = true;
      if (subKeyInput) subKeyInput.disabled = true;

      const saveBtns = document.querySelectorAll('#settingsTab .primary-btn');
      saveBtns.forEach(btn => btn.style.display = 'none');
    }

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

    const logs = await auditService.fetchLogs(30);

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

  async saveSupabaseSettings() {
    if (typeof auth !== 'undefined' && typeof auth.isOwner === 'function' && !auth.isOwner()) {
      alert('🔒 Access Restricted: Only Owner (Disha) can modify Supabase Cloud DB settings!');
      return;
    }
    const rawUrl = document.getElementById('supabaseUrlInput').value.trim();
    const key = document.getElementById('supabaseKeyInput').value.trim();

    dbConfig.saveCredentials(rawUrl, key);
    alert('🎉 Supabase Cloud PostgreSQL DB settings saved successfully!');
    this.init();
  }

  async testSupabaseConnection() {
    const client = dbConfig.getClient();
    if (!client) {
      alert('Please enter your Supabase Project URL and Anon Key first!');
      return;
    }

    try {
      const { data, error } = await client.from('transactions').select('id').limit(1);
      if (error) {
        alert('Supabase Connection Error: ' + error.message + '\nMake sure you executed database/supabase_setup.sql in Supabase SQL Editor!');
      } else {
        alert('🎉 Supabase Connection Successful! Connected to 24/7 Cloud DB!');
      }
    } catch (err) {
      alert('Connection failed: ' + err.toString());
    }
  }

  async saveSettings() {
    if (typeof auth !== 'undefined' && typeof auth.isOwner === 'function' && !auth.isOwner()) {
      alert('🔒 Access Restricted: Only Owner (Disha) can modify Google Sheet URL settings!');
      return;
    }
    const url = document.getElementById('googleSheetScriptUrl').value.trim();
    this.googleScriptUrl = url;
    await budgetService.saveConfig('google_sheet_url', url);
    alert('Google Apps Script Web App URL saved successfully to Cloud DB!');
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

    setInterval(() => {
      const now = new Date();
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

  // --- Service Worker Registration ---
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js')
        .then(() => console.log('PWA Service Worker registered successfully.'))
        .catch(err => console.warn('Service Worker registration failed:', err));
    }
  }

  exportCSV() {
    if (this.transactions.length === 0) {
      alert('No data available to export!');
      return;
    }
    const headers = ['ID', 'DateTime', 'Type', 'Category', 'Amount', 'PaymentMethod', 'Notes', 'LoggedBy'];
    const rows = this.transactions.map(t => [t.id, t.datetime, t.type, t.category, t.amount, t.paymentMethod, `"${t.notes || ''}"`, t.loggedBy]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DiShiv_PayTracker_Export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

let app;
document.addEventListener('DOMContentLoaded', () => {
  app = new PayTrackerApp();
});
