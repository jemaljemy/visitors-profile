// --- Global State Variables ---
let db = null;
let visitorsList = [];
let selectedVisitorId = null;

// --- Data Persistence Functions using sql.js ---

// Helper function to convert query results to an array of objects
const sqlQueryToObjects = (res) => {
    if (!res || res.length === 0) return [];
    const columns = res[0].columns;
    const values = res[0].values;
    return values.map(row => {
        const obj = {};
        columns.forEach((col, index) => {
            obj[col] = row[index];
        });
        return obj;
    });
};

const loadVisitorsFromDb = async () => {
    const res = db.exec("SELECT * FROM visitors");
    visitorsList = sqlQueryToObjects(res);
    console.log("Visitors data loaded from SQLite:", visitorsList);
};

const saveDbToLocalStorage = () => {
    const binaryArray = db.export();
    const buffer = new Uint8Array(binaryArray);
    const stringifiedBuffer = JSON.stringify(Array.from(buffer)); // Convert to JSON string
    localStorage.setItem('sqliteDb', stringifiedBuffer);
};

// --- Utility Functions ---

const isVisitorBanned = (visitor) => {
    if (!visitor || !visitor.isBanned || !visitor.bannedUntil) return false;
    return new Date(visitor.bannedUntil) > new Date();
};

const showMessageBox = (message, type = 'success') => {
    const messageBox = document.getElementById('messageBox');
    if (messageBox) {
        messageBox.textContent = message;
        messageBox.classList.remove('hidden');
        if (type === 'success') {
            messageBox.className = 'p-3 rounded-md text-center bg-green-500 text-white';
        } else if (type === 'error') {
            messageBox.className = 'p-3 rounded-md text-center bg-red-500 text-white';
        }
        setTimeout(() => {
            messageBox.classList.add('hidden');
        }, 3000); // Hide after 3 seconds
    }
};

// --- UI Rendering Functions ---
const renderFoundProfile = (visitor) => {
    const profileBox = document.getElementById('foundProfileBox');
    const generalNotesBox = document.getElementById('generalNotesBox');
    const statusSpan = document.getElementById('profileStatus');

    if (profileBox && generalNotesBox) {
        if (visitor) {
            console.log("Rendering visitor profile:", visitor);

            profileBox.classList.remove('hidden');
            document.getElementById('profileName').textContent = `${visitor.firstName} ${visitor.lastName}`;
            document.getElementById('profileFlat').textContent = (visitor.flatNumber && visitor.flatNumber.length > 0) ? `Flat: ${visitor.flatNumber}` : 'Flat: N/A';
            document.getElementById('profileDob').textContent = visitor.dateOfBirth ? `Date of Birth: ${visitor.dateOfBirth}` : 'Date of Birth: N/A';
            document.getElementById('profileNotes').textContent = visitor.notes || 'Notes: N/A';
            document.getElementById('profileImage').src = visitor.scannedIdPicUrl || 'https://placehold.co/400x250/000000/FFFFFF?text=No+ID';
            
            const isBanned = isVisitorBanned(visitor);

            if (isBanned) {
                const bannedUntilDate = new Date(visitor.bannedUntil);
                const now = new Date();
                const diffInMs = bannedUntilDate.getTime() - now.getTime();
                const diffInDays = Math.ceil(diffInMs / (1000 * 60 * 60 * 24));
                
                statusSpan.textContent = `BANNED (for ${diffInDays} day${diffInDays > 1 ? 's' : ''})`;
                statusSpan.className = 'text-lg font-bold text-red-500';
            } else {
                statusSpan.textContent = 'CLEARED';
                statusSpan.className = 'text-lg font-bold text-green-500';
            }

            document.getElementById('profileBanButton').onclick = () => openModal(visitor.id);
            document.getElementById('profileUnbanButton').onclick = () => handleUnban(visitor.id);

            generalNotesBox.classList.remove('hidden');
            document.getElementById('generalNotesInput').value = visitor.generalNotes || '';
        } else {
            profileBox.classList.add('hidden');
            generalNotesBox.classList.add('hidden');
        }
    }
};

const showModal = () => {
    document.getElementById('banModal').classList.remove('hidden');
};

const hideModal = () => {
    document.getElementById('banModal').classList.add('hidden');
};

// --- Event Handlers and SQLite Logic ---

const handleSearch = (e) => {
    const searchTerm = e.target.value.toLowerCase();
    if (searchTerm.length > 0) {
        const foundVisitor = visitorsList.find(
            (visitor) =>
            (visitor.firstName && visitor.firstName.toLowerCase().includes(searchTerm)) ||
            (visitor.lastName && visitor.lastName.toLowerCase().includes(searchTerm))
        );
        selectedVisitorId = foundVisitor ? foundVisitor.id : null;
        renderFoundProfile(foundVisitor);
    } else {
        selectedVisitorId = null;
        renderFoundProfile(null);
    }
};

const updateVisitorStatus = async (visitorId, newStatus) => {
    if (!visitorId) return;
    try {
        // Prepare the SQL update statement
        const isBanned = newStatus.isBanned ? 1 : 0; // SQLite does not have booleans
        const bannedUntil = newStatus.bannedUntil;
        const notes = newStatus.notes || '';

        db.run("UPDATE visitors SET isBanned = ?, notes = ?, bannedUntil = ? WHERE id = ?", [isBanned, notes, bannedUntil, visitorId]);
        
        // Save the changes and re-render
        saveDbToLocalStorage();
        await loadVisitorsFromDb();
        renderFoundProfile(visitorsList.find(v => v.id === visitorId));
        
        showMessageBox('Visitor status updated successfully!', 'success');
    } catch (error) {
        console.error("Error updating visitor status in SQLite:", error);
        showMessageBox('Failed to update visitor status.', 'error');
    }
};

const updateGeneralNotes = async (visitorId, notes) => {
    if (!visitorId) {
        showMessageBox('Please search for a visitor first.', 'error');
        return;
    }
    try {
        db.run("UPDATE visitors SET generalNotes = ? WHERE id = ?", [notes, visitorId]);
        
        saveDbToLocalStorage();
        await loadVisitorsFromDb();
        renderFoundProfile(visitorsList.find(v => v.id === visitorId));

        showMessageBox('Notes saved successfully!', 'success');
    } catch (error) {
        console.error("Error updating general notes in SQLite:", error);
        showMessageBox('Failed to save notes.', 'error');
    }
};

const handleBan = (visitorId, notes, banPeriod) => {
    if (!visitorId) return;
    const bannedUntil = banPeriod > 0 ? new Date(Date.now() + banPeriod * 24 * 60 * 60 * 1000).toISOString() : null;
    updateVisitorStatus(visitorId, { isBanned: true, notes, bannedUntil });
    hideModal();
};

const handleUnban = (visitorId) => {
    if (!visitorId) return;
    updateVisitorStatus(visitorId, { isBanned: false, notes: '', bannedUntil: null });
    hideModal();
};

const openModal = (visitorId) => {
    selectedVisitorId = visitorId;
    const visitorData = visitorsList.find(v => v.id === visitorId);
    document.getElementById('modalNotes').value = visitorData?.notes || '';
    let banPeriod = 0;
    if (visitorData?.bannedUntil) {
        const banDate = new Date(visitorData.bannedUntil);
        const diffInDays = Math.ceil((banDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        if (diffInDays > 0) banPeriod = diffInDays;
    }
    document.getElementById('modalBanPeriod').value = banPeriod;
    showModal();
};

// --- CSV Import Logic ---

const parseCsv = (csvText) => {
    const lines = csvText.trim().split('\n');
    const headers = lines[0].split(',').map(header => header.trim());
    const data = lines.slice(1).map(line => {
        const values = line.split(',').map(value => value.trim());
        const visitor = {};
        headers.forEach((header, index) => {
            visitor[header] = values[index];
        });
        return visitor;
    });
    return data;
};

const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
        const csvData = event.target.result;
        const importedVisitors = parseCsv(csvData);
        let importedCount = 0;

        try {
            db.run("BEGIN TRANSACTION;");
            for (const visitor of importedVisitors) {
                // Generate a new unique ID for each imported visitor
                const newId = uuidv4();
                
                // Default values for boolean and date fields
                const isBanned = visitor.isBanned === 'true' || visitor.isBanned === '1' ? 1 : 0;
                const bannedUntil = visitor.bannedUntil || null;
                
                db.run(
                    "INSERT INTO visitors (id, firstName, lastName, flatNumber, dateOfBirth, scannedIdPicUrl, isBanned, notes, generalNotes, bannedUntil) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", 
                    [
                        newId,
                        visitor.firstName,
                        visitor.lastName,
                        visitor.flatNumber,
                        visitor.dateOfBirth,
                        visitor.scannedIdPicUrl,
                        isBanned,
                        visitor.notes,
                        visitor.generalNotes,
                        bannedUntil
                    ]
                );
                importedCount++;
            }
            db.run("COMMIT;");
            saveDbToLocalStorage();
            await loadVisitorsFromDb();
            showMessageBox(`Successfully imported ${importedCount} visitor(s).`, 'success');

        } catch (error) {
            db.run("ROLLBACK;");
            console.error("Error during CSV import:", error);
            showMessageBox('Failed to import data.', 'error');
        }
    };
    reader.readAsText(file);
};

// --- Main Initialization Logic ---

const initializeDb = async () => {
    try {
        // Load the sql.js library
        const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/${file}`
        });

        // Check if a database exists in local storage
        const storedDb = localStorage.getItem('sqliteDb');
        if (storedDb) {
            const binaryArray = JSON.parse(storedDb);
            db = new SQL.Database(new Uint8Array(binaryArray));
            console.log("Database loaded from local storage.");
        } else {
            // Create a new database if none exists
            db = new SQL.Database();
            console.log("New database created.");
        }
        
        // Create the visitors table if it doesn't exist
        db.run(`
            CREATE TABLE IF NOT EXISTS visitors (
                id TEXT PRIMARY KEY,
                firstName TEXT,
                lastName TEXT,
                flatNumber TEXT,
                dateOfBirth TEXT,
                scannedIdPicUrl TEXT,
                isBanned INTEGER,
                notes TEXT,
                generalNotes TEXT,
                bannedUntil TEXT
            );
        `);

        // Check if the table is empty and seed it if needed
        const countRes = db.exec("SELECT COUNT(*) FROM visitors");
        if (countRes[0].values[0][0] === 0) {
            console.log("Seeding initial data...");
            const initialData = [
                { id: uuidv4(), firstName: "John", lastName: "Smith", flatNumber: "1A", dateOfBirth: "1990-05-15", scannedIdPicUrl: "https://placehold.co/400x250/000000/FFFFFF?text=Scanned+ID+Pic", isBanned: 0, notes: "", generalNotes: "Has been known to cause loud disturbances in the past.", bannedUntil: null },
                { id: uuidv4(), firstName: "Jane", lastName: "Doe", flatNumber: "2B", dateOfBirth: "1992-08-20", scannedIdPicUrl: "https://placehold.co/400x250/000000/FFFFFF?text=Scanned+ID+Pic", isBanned: 0, notes: "", generalNotes: "A frequent visitor. Always polite.", bannedUntil: null },
                { id: uuidv4(), firstName: "jackson", lastName: "boss", flatNumber: "3", dateOfBirth: "1992-08-20", scannedIdPicUrl: "https://placehold.co/400x250/000000/FFFFFF?text=Scanned+ID+Pic", isBanned: 0, notes: "", generalNotes: "A frequent visitor. Always polite.", bannedUntil: null }
            ];
            initialData.forEach(visitor => {
                db.run("INSERT INTO visitors VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [
                    visitor.id,
                    visitor.firstName,
                    visitor.lastName,
                    visitor.flatNumber,
                    visitor.dateOfBirth,
                    visitor.scannedIdPicUrl,
                    visitor.isBanned,
                    visitor.notes,
                    visitor.generalNotes,
                    visitor.bannedUntil
                ]);
            });
            saveDbToLocalStorage();
        }

        // Initial data load
        await loadVisitorsFromDb();

        // Attach event listeners
        document.getElementById('search').addEventListener('input', handleSearch);
        document.getElementById('modalCancelButton').addEventListener('click', hideModal);
        document.getElementById('modalConfirmBanButton').addEventListener('click', () => {
            const notes = document.getElementById('modalNotes').value;
            const banPeriod = parseInt(document.getElementById('modalBanPeriod').value, 10);
            handleBan(selectedVisitorId, notes, banPeriod);
        });
        document.getElementById('saveGeneralNotesButton').addEventListener('click', () => {
            const notes = document.getElementById('generalNotesInput').value;
            updateGeneralNotes(selectedVisitorId, notes);
        });

        // Attach CSV import event listeners
        document.getElementById('importVisitorsButton').addEventListener('click', () => {
            document.getElementById('csvFile').click();
        });
        document.getElementById('csvFile').addEventListener('change', handleImport);

        // Hide loading and show app
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');

    } catch (error) {
        console.error("Error initializing SQLite database:", error);
        document.body.innerHTML = `<div class="flex items-center justify-center min-h-screen bg-red-900 text-white"><p class="text-xl">Failed to load app. Check console for errors.</p></div>`;
    }
};

window.onload = initializeDb;
