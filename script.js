lucide.createIcons();

let parsedData = [];
let currentEditIndex = null;
let currentPage = 1;
const mobilePageSize = 5; 

const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

// Inisialisasi Pilihan Bulan & Tahun
function initPeriodSelectors() {
    const monthSelect = document.getElementById('periodMonthSelect');
    const yearSelect = document.getElementById('periodYearSelect');
    
    if (!monthSelect || !yearSelect) return;

    monthSelect.innerHTML = '';
    yearSelect.innerHTML = '';

    const currentDate = new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();

    monthNames.forEach((month, index) => {
        const opt = document.createElement('option');
        opt.value = index;
        opt.textContent = month;
        if (index === currentMonth) opt.selected = true;
        monthSelect.appendChild(opt);
    });

    for (let y = currentYear - 2; y <= currentYear + 3; y++) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if (y === currentYear) opt.selected = true;
        yearSelect.appendChild(opt);
    }
}

// Mendapatkan teks periode terformat (misal: "1 - 31 Agustus 2026")
function getSelectedPeriodText() {
    const monthSelect = document.getElementById('periodMonthSelect');
    const yearSelect = document.getElementById('periodYearSelect');

    if (!monthSelect || !yearSelect) return '1 - 31 Agustus 2026';

    const monthIndex = parseInt(monthSelect.value, 10); // 0 = Januari, 1 = Februari, dst.
    const year = parseInt(yearSelect.value, 10);

    // Angka 0 di tanggal berarti mengambil hari terakhir dari bulan sebelumnya (monthIndex + 1)
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    const monthName = monthNames[monthIndex];

    return `1 - ${lastDay} ${monthName} ${year}`;
}

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>'"]/g, 
        tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag])
    );
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeButton(newTheme);
}

function updateThemeButton(theme) {
    const btn = document.getElementById('themeBtn');
    if (theme === 'dark') {
        btn.innerHTML = `<i data-lucide="sun" style="width: 16px; height: 16px;"></i> Mode Terang`;
    } else {
        btn.innerHTML = `<i data-lucide="moon" style="width: 16px; height: 16px;"></i> Mode Gelap`;
    }
    lucide.createIcons();
}

const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeButton(savedTheme);

// Jalankan inisialisasi dropdown periode
initPeriodSelectors();

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('csvFileInput');

dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => { dropZone.classList.remove('dragover'); });
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        handleFile(e.dataTransfer.files[0]);
    }
});
fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
});

function handleFile(file) {
    if (!file) return;
    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) { processData(results.data); },
        error: function(err) { alert('Gagal membaca CSV: ' + err.message); }
    });
}

function processData(data) {
    parsedData = [];
    data.forEach(row => {
        const getVal = (keys) => {
            for(let k of keys) {
                const val = row[k] || row[k.trim()];
                if(val) return val;
            }
            return '';
        };

        let name = getVal(['Customer Name', 'CustomerName']);
        let rawPhone = getVal(['Customer Phone', 'CustomerPhone']);
        let invoice = getVal(['Invoice Number', 'InvoiceNumber']);
        let amount = parseFloat(getVal(['Total Amount', 'TotalAmount'])) || 0;
        let rawDate = getVal(['Expired Date', 'ExpiredDate']);
        let link = getVal(['Payment Link', 'PaymentLink']);

        let cleanPhone = rawPhone.replace(/[^0-9]/g, '');
        if (cleanPhone.startsWith('0')) cleanPhone = '62' + cleanPhone.slice(1);
        else if (cleanPhone.startsWith('8')) cleanPhone = '62' + cleanPhone;

        let formattedAmount = 'Rp ' + amount.toLocaleString('id-ID');
        let dueDate = rawDate.split(',')[0] || rawDate;

        if (name || cleanPhone || invoice) {
            parsedData.push({
                name: name,
                phone: cleanPhone,
                invoice: invoice,
                amount: formattedAmount,
                dueDate: dueDate,
                link: link,
                selected: true,
                customMessage: null
            });
        }
    });

    currentPage = 1;
    renderTable();
}

function isMobile() {
    return window.innerWidth <= 768;
}

function onSearchInput() {
    currentPage = 1;
    renderTable();
}

function renderTable() {
    const tbody = document.querySelector('#dataTable tbody');
    tbody.innerHTML = '';

    const searchTerm = document.getElementById('searchInput').value.toLowerCase().trim();
    
    const filteredData = parsedData.filter(item => {
        return item.name.toLowerCase().includes(searchTerm) ||
               item.phone.includes(searchTerm) ||
               item.invoice.toLowerCase().includes(searchTerm);
    });

    document.getElementById('statsBadge').innerText = `Total: ${filteredData.length} Pelanggan`;

    if (filteredData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 40px;">Data tidak ditemukan.</td></tr>`;
        document.getElementById('paginationControls').style.display = 'none';
        return;
    }

    let displayData = filteredData;
    if (isMobile()) {
        document.getElementById('paginationControls').style.display = 'flex';
        const totalPages = Math.ceil(filteredData.length / mobilePageSize) || 1;
        if (currentPage > totalPages) currentPage = totalPages;

        const start = (currentPage - 1) * mobilePageSize;
        displayData = filteredData.slice(start, start + mobilePageSize);

        document.getElementById('pageIndicator').innerText = `Hal ${currentPage} dari ${totalPages}`;
        document.getElementById('prevPageBtn').disabled = (currentPage === 1);
        document.getElementById('nextPageBtn').disabled = (currentPage === totalPages);
    } else {
        document.getElementById('paginationControls').style.display = 'none';
    }

    displayData.forEach((item) => {
        const realIndex = parsedData.indexOf(item);
        
        const safeName = escapeHTML(item.name);
        const safePhone = escapeHTML(item.phone);
        const safeInvoice = escapeHTML(item.invoice);
        const safeAmount = escapeHTML(item.amount);
        const isEdited = item.customMessage !== null && item.customMessage !== undefined;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="Pilih" style="text-align: center;">
                <input type="checkbox" ${item.selected ? 'checked' : ''} onchange="parsedData[${realIndex}].selected = this.checked" style="width: 16px; height: 16px; cursor: pointer;">
            </td>
            <td data-label="Nama">
                <input type="text" class="input-inline" value="${safeName}" onchange="parsedData[${realIndex}].name = this.value">
                ${isEdited ? '<span class="badge-edited"><i data-lucide="pencil" style="width:10px;height:10px;"></i> Diedit</span>' : ''}
            </td>
            <td data-label="No. WA">
                <input type="text" class="input-inline" value="${safePhone}" onchange="parsedData[${realIndex}].phone = this.value">
            </td>
            <td data-label="No. Invoice" style="font-weight: 500;">${safeInvoice}</td>
            <td data-label="Tagihan" style="font-weight: 600; color: var(--primary-orange);">${safeAmount}</td>
            <td data-label="Aksi">
                <div class="action-group">
                    <button class="btn btn-edit" title="Edit Pesan" onclick="openEditModal(${realIndex})">
                        <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i> Edit
                    </button>
                    <button class="btn btn-preview" title="Preview Pesan" onclick="openPreview(${realIndex})">
                        <i data-lucide="eye" style="width: 14px; height: 14px;"></i> Cek
                    </button>
                    <button class="btn btn-send" title="Kirim WA" onclick="sendWA(${realIndex})">
                        <i data-lucide="send" style="width: 14px; height: 14px;"></i> Kirim
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
    lucide.createIcons();
}

function changePage(direction) {
    currentPage += direction;
    renderTable();
}

window.addEventListener('resize', () => { renderTable(); });

function toggleSelectAll(master) {
    parsedData.forEach(item => item.selected = master.checked);
    renderTable();
}

function generateDefaultMessage(item) {
    let template = document.getElementById('templateText').value;
    const periodStr = getSelectedPeriodText();

    return template
        .replaceAll('{NAME}', item.name)
        .replaceAll('{INVOICE}', item.invoice)
        .replaceAll('{PERIOD}', periodStr)
        .replaceAll('{AMOUNT}', item.amount)
        .replaceAll('{DUE_DATE}', item.dueDate)
        .replaceAll('{LINK}', item.link);
}

function getMessage(item) {
    return (item.customMessage !== null && item.customMessage !== undefined) ? item.customMessage : generateDefaultMessage(item);
}

function openEditModal(index) {
    currentEditIndex = index;
    const item = parsedData[index];
    document.getElementById('editCustomerName').textContent = item.name || 'Pelanggan';
    document.getElementById('editMessageText').value = getMessage(item);
    document.getElementById('editModal').classList.add('active');
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('active');
    currentEditIndex = null;
}

function saveCustomMessage() {
    if (currentEditIndex !== null) {
        parsedData[currentEditIndex].customMessage = document.getElementById('editMessageText').value;
        closeEditModal();
        renderTable();
    }
}

function resetDefaultMessage() {
    if (currentEditIndex !== null) {
        const item = parsedData[currentEditIndex];
        item.customMessage = null;
        document.getElementById('editMessageText').value = generateDefaultMessage(item);
        renderTable();
    }
}

function sendWA(index) {
    const item = parsedData[index];
    if (!item.phone || item.phone.length < 9) {
        alert('Nomor WhatsApp tidak valid!');
        return;
    }
    const text = getMessage(item);
    const url = `https://wa.me/${encodeURIComponent(item.phone)}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
}

function openPreview(index) {
    const item = parsedData[index];
    const msg = getMessage(item);

    document.getElementById('modalCustomerName').textContent = item.name || 'Pelanggan';
    document.getElementById('modalCustomerPhone').textContent = '+' + item.phone;
    document.getElementById('modalAvatar').textContent = (item.name ? item.name[0] : 'S').toUpperCase();
    document.getElementById('modalMessageContent').textContent = msg;

    const url = `https://wa.me/${encodeURIComponent(item.phone)}?text=${encodeURIComponent(msg)}`;
    document.getElementById('modalSendBtn').setAttribute('href', url);

    document.getElementById('previewModal').classList.add('active');
}

function closePreview() {
    document.getElementById('previewModal').classList.remove('active');
}

document.getElementById('previewModal').addEventListener('click', function(e) { if (e.target === this) closePreview(); });
document.getElementById('editModal').addEventListener('click', function(e) { if (e.target === this) closeEditModal(); });
