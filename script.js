//****** */
// ndhddjjdjd
// --- Global State Variables ---
let db = null;
let visitorsList = [];
let selectedVisitorId = null;

// --- Data Persistence Functions using sql.js ---

/**
 * Converts a SQLite query result object into a clean array of JavaScript objects.
 * @param {Object[]} res - The result array from db.exec().
 * @returns {Object[]} An array of objects, where each object represents a row.
 */
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

/**
 * Loads all visitor data from the SQLite database into the global visitorsList array.
 */
const loadVisitorsFromDb = async () => {
    const res = db.exec("SELECT * FROM visitors");
    visitorsList = sqlQueryToObjects(res);
    console.log("Visitors data loaded from SQLite:", visitorsList);
};

/**
 * Saves the current state of the SQLite database to the browser's local storage.
 * This is crucial for data persistence between sessions.
 */
const saveDbToLocalStorage = () => {
    const binaryArray = db.export();
    const buffer = new Uint8Array(binaryArray);
    const stringifiedBuffer = JSON.stringify(Array.from(buffer));
    localStorage.setItem('sqliteDb', stringifiedBuffer);
};

// --- Utility Functions ---

/**
 * Checks if a visitor is currently banned based on their bannedUntil date.
 * @param {Object} visitor - The visitor object.
 * @returns {boolean} True if the visitor is banned, false otherwise.
 */
const isVisitorBanned = (visitor) => {
    return visitor && visitor.isBanned ===1;
};

/**
 * Displays a temporary message box for user feedback.
 * @param {string} message - The message to display.
 * @param {string} type - The type of message ('success' or 'error') to determine styling.
 */
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
        }, 3000);
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
            document.getElementById('profilePhone').textContent = visitor.phoneNumber ? `Phone: ${visitor.phoneNumber}` : 'Phone: N/A';
            document.getElementById('profileDob').textContent = visitor.dateOfBirth ? `Date of Birth: ${visitor.dateOfBirth}` : 'Date of Birth: N/A';
            document.getElementById('profileNotes').textContent = visitor.notes || 'Notes: N/A';
            document.getElementById('profileImage').src = visitor.scannedIdPicUrl || 'https://placehold.co/400x250/000000/FFFFFF?text=No+ID';

            const isBanned = isVisitorBanned(visitor);

            if (isBanned) {
                statusSpan.textContent = 'BANNED';
                statusSpan.className = 'profile-status banned';

            } else {
                statusSpan.textContent = 'CLEARED';
                statusSpan.className = 'profile-status cleared';
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
        const isBanned = newStatus.isBanned ? 1 : 0;
        const bannedUntil = null;
        const notes = newStatus.notes || '';

        db.run("UPDATE visitors SET isBanned = ?, notes = ? WHERE id = ?", [isBanned, notes, visitorId]);
        
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

const handleBan = () => {
    if (!selectedVisitorId) return;
        const notes = document.getElementById('modalNotes').value;
            // Ban is now permanent
        updateVisitorStatus(selectedVisitorId, { isBanned: true, notes });
    hideModal();
};

const handleUnban = (visitorId) => {
    if (!visitorId) return;
    updateVisitorStatus(visitorId, { isBanned: false, notes: ''});
    hideModal();
};

const openModal = (visitorId) => {
    selectedVisitorId = visitorId;
    const visitorData = visitorsList.find(v => v.id === visitorId);
    document.getElementById('modalNotes').value = visitorData?.notes || '';
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

// This is the CORRECTED function for handling CSV imports
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
            console.log("Parsed CSV Data:", importedVisitors); // Log the parsed data for debugging
            db.run("BEGIN TRANSACTION;");
            for (const visitor of importedVisitors) {
                // Ensure required fields exist before attempting an insert/update
                if (!visitor.firstName || !visitor.lastName) {
                    console.error("Skipping a row due to missing firstName or lastName:", visitor);
                    continue;
                }

                const visitorId = visitor.id || uuidv4();
                const isBanned = visitor.isBanned === 'true' || visitor.isBanned === '1' ? 1 : 0;
                
                // Check if the visitor already exists
                const existingVisitor = db.exec("SELECT * FROM visitors WHERE id = ?", [visitorId]);
                
                if (existingVisitor.length > 0) {
                    console.log(`Updating existing visitor with ID: ${visitorId}`);
                    // If they exist, only UPDATE the CSV-related fields
                    db.run(
                        "UPDATE visitors SET firstName = ?, lastName = ?, flatNumber = ?, phoneNumber = ?, dateOfBirth = ?, scannedIdPicUrl = ?, isBanned = ?, notes = ? WHERE id = ?"
                        [
                            visitor.firstName,
                            visitor.lastName,
                            visitor.flatNumber,
                            visitor.phoneNumber,
                            visitor.dateOfBirth,
                            visitor.scannedIdPicUrl,
                            isBanned,
                            visitor.notes,
                            visitorId
                        ]
                    );
                } else {
                    console.log(`Inserting new visitor with ID: ${visitorId}`);
                    // If they don't exist, INSERT a new record
                    db.run(
                        "INSERT INTO visitors (id, firstName, lastName, flatNumber, phoneNumber, dateOfBirth, scannedIdPicUrl, isBanned, notes, generalNotes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", 
                        [
                            visitorId,
                            visitor.firstName,
                            visitor.lastName,
                            visitor.flatNumber,
                            visitor.phoneNumber,
                            visitor.dateOfBirth,
                            visitor.scannedIdPicUrl,
                            isBanned,
                            visitor.notes,
                            '', // Use a blank string for new notes, as it won't be in the CS
                        ]
                    );
                }
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
        const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.6.2/${file}`
        });

        const storedDb = localStorage.getItem('sqliteDb');
        if (storedDb) {
            const binaryArray = JSON.parse(storedDb);
            db = new SQL.Database(new Uint8Array(binaryArray));
            console.log("Database loaded from local storage.");
        } else {
            db = new SQL.Database();
            console.log("New database created.");
        }
        
        db.run(`
            CREATE TABLE IF NOT EXISTS visitors (
                id TEXT PRIMARY KEY,
                firstName TEXT,
                lastName TEXT,
                flatNumber TEXT,
                phoneNumber TEXT,
                dateOfBirth TEXT,
                scannedIdPicUrl TEXT,
                isBanned INTEGER,
                notes TEXT,
                generalNotes TEXT
            );
        `);

        // Fix for old database schemas - ensures all columns exist
        try {
            db.exec("ALTER TABLE visitors ADD COLUMN phoneNumber TEXT;");
            console.log("Added 'phoneNumber' column to the visitors table.");
        } catch (e) { /* Column already exists */ }
        try {
            db.exec("ALTER TABLE visitors ADD COLUMN generalNotes TEXT;");
            console.log("Added 'generalNotes' column to the visitors table.");
        } catch (e) { /* Column already exists */ }

        await loadVisitorsFromDb();

        document.getElementById('search').addEventListener('input', handleSearch);
        document.getElementById('modalCancelButton').addEventListener('click', hideModal);
        document.getElementById('modalConfirmBanButton').addEventListener('click', () => {
            
            handleBan();
        });
        document.getElementById('saveGeneralNotesButton').addEventListener('click', () => {
            const notes = document.getElementById('generalNotesInput').value;
            updateGeneralNotes(selectedVisitorId, notes);
        });

        document.getElementById('importVisitorsButton').addEventListener('click', () => {
            document.getElementById('csvFile').click();
        });
        document.getElementById('csvFile').addEventListener('change', handleImport);

        document.getElementById('loading').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');

    } catch (error) {
        console.error("Error initializing SQLite database:", error);
        document.body.innerHTML = `<div class="flex items-center justify-center min-h-screen bg-red-900 text-white"><p class="text-xl">Failed to load app. Check console for errors.</p></div>`;
    }
};

// A simple utility function to generate a unique ID
function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

window.onload = initializeDb;
