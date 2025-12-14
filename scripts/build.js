#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BUILD_DIR = 'builddir';

console.log('🚀 Building GNOME App...');

// Clean directories
if (fs.existsSync(BUILD_DIR)) {
    fs.rmSync(BUILD_DIR, { recursive: true });
}

// Create directories
fs.mkdirSync(BUILD_DIR, { recursive: true });

// Compile TypeScript
console.log('🔨 Compiling TypeScript...');
try {
    execSync('npx tsc --outDir builddir --rootDir src', { stdio: 'inherit' });
} catch (error) {
    console.error('❌ TypeScript compilation failed');
    process.exit(1);
}

console.log('🔄 Converting for GJS...');

// Function to clean CommonJS/TypeScript artifacts from generated JS
function cleanJSContent(content) {
    return content
        // Remove CommonJS exports
        .replace(/exports\.\w+\s*=.*?;?\n?/g, '')
        .replace(/Object\.defineProperty\(exports,.*?\n/g, '')
        .replace(/exports\s*=\s*void 0;\s*\n?/g, '')
        .replace(/"use strict";\s*\n?/g, '')
        .replace(/var __importDefault.*?\n/g, '')
        .replace(/this && this\.__importDefault.*?\n/g, '')
        .replace(/return \(mod && mod\.__esModule\).*?\n/g, '')
        .replace(/\};\s*\n?/g, '')

        // Remove require statements and imports
        .replace(/const.*?require\(.*?\).*?;\s*\n?/g, '')
        .replace(/const.*?__importDefault.*?;\s*\n?/g, '')

        // Replace TypeScript generated references
        .replace(/gtk_4_0_1\.default\./g, 'Gtk.')
        .replace(/gdk_4_0_1\.default\./g, 'Gdk.')
        .replace(/gio_2_0_1\.default\./g, 'Gio.')
        .replace(/glib_2_0_1\.default\./g, 'GLib.')
        .replace(/pango_1_0_1\.default\./g, 'Pango.')
        .replace(/adw_1_1\.default\./g, 'Adw.')

        // Replace service references
        .replace(/logger_service_1\.LoggerService\.instance/g, 'LoggerService.instance')
        .replace(/logger_service_js_1\.LoggerService\.instance/g, 'LoggerService.instance')
        .replace(/settings_service_1\.SettingsService\.instance/g, 'SettingsService.instance')
        .replace(/settings_service_js_1\.SettingsService\.instance/g, 'SettingsService.instance')

        // Remove other artifacts
        .replace(/\s*void 0;\s*\n?/g, '')
        .replace(/^\s*\n/gm, '') // Remove empty lines
        .trim();
}

// GJS header
const gjsHeader = `#!/usr/bin/env gjs

const { Gio } = imports.gi;
const { Gtk } = imports.gi;
const { Gdk } = imports.gi;
const { Adw } = imports.gi;
const { GLib } = imports.gi;
const { Pango } = imports.gi;

imports.gi.versions.Gtk = '4.0';
imports.gi.versions.Adw = '1';

`;

// Read and process the components
let combinedContent = gjsHeader;

// First, add the interfaces from interfaces file if it exists
const applicationInterfaceFile = path.join(BUILD_DIR, 'interfaces', 'application.js');
if (fs.existsSync(applicationInterfaceFile)) {
    let applicationInterfaceContent = fs.readFileSync(applicationInterfaceFile, 'utf8');
    // Extract interface definitions (they will be removed by transpilation)
    console.log('📋 Adding interfaces...');
}

// First, add the interfaces from interfaces file if it exists
const categoryInterfaceFile = path.join(BUILD_DIR, 'interfaces', 'category.js');
if (fs.existsSync(categoryInterfaceFile)) {
    let categoryInterfaceContent = fs.readFileSync(categoryInterfaceFile, 'utf8');
    // Extract interface definitions (they will be removed by transpilation)
    console.log('📋 Adding interfaces...');
}

// Add LoggerService service (must be first, as other services depend on it)
const loggerServiceFile = path.join(BUILD_DIR, 'services', 'logger-service.js');
if (fs.existsSync(loggerServiceFile)) {
    console.log('📋 Adding LoggerService service...');
    let loggerServiceContent = fs.readFileSync(loggerServiceFile, 'utf8');

    // Clean up the content - find the LogLevel enum start
    const enumStartIndex = loggerServiceContent.indexOf('var LogLevel;');
    if (enumStartIndex !== -1) {
        loggerServiceContent = loggerServiceContent.substring(enumStartIndex);
    }

    // Clean up TypeScript/CommonJS artifacts
    loggerServiceContent = loggerServiceContent
        .replace(/exports\.\w+\s*=.*?;?\n?/g, '')
        .replace(/Object\.defineProperty\(exports,.*?\n/g, '')
        .replace(/"use strict";\s*\n?/g, '')
        .replace(/var __importDefault.*?\n/g, '')
        .replace(/const.*?require\(.*?\).*?;\s*\n?/g, '')
        .replace(/glib_2_0_1\.default\./g, 'GLib.')
        .replace(/\(LogLevel \|\| \(exports\.LogLevel = LogLevel = \{\}\)\);/, '(LogLevel || (LogLevel = {}));')
        .replace(/exports\.LogLevel = /g, '')
        .trim();

    combinedContent += loggerServiceContent + '\n';
}

// Add UtilsService service
const utilsServiceFile = path.join(BUILD_DIR, 'services', 'utils-service.js');
if (fs.existsSync(utilsServiceFile)) {
    console.log('📋 Adding UtilsService service...');
    let utilsServiceContent = fs.readFileSync(utilsServiceFile, 'utf8');

    // Clean up the content - find the class definition start
    const classStartIndex = utilsServiceContent.indexOf('class UtilsService {');
    if (classStartIndex !== -1) {
        utilsServiceContent = utilsServiceContent.substring(classStartIndex);
    }

    // Clean up TypeScript/CommonJS artifacts using our function
    utilsServiceContent = cleanJSContent(utilsServiceContent);

    combinedContent += utilsServiceContent + '\n';
}

// Add DataService service
const dataServiceFile = path.join(BUILD_DIR, 'services', 'data-service.js');
if (fs.existsSync(dataServiceFile)) {
    console.log('📋 Adding DataService service...');
    let dataServiceContent = fs.readFileSync(dataServiceFile, 'utf8');

    // Clean up the content - find the class definition start
    const classStartIndex = dataServiceContent.indexOf('class DataService {');
    if (classStartIndex !== -1) {
        dataServiceContent = dataServiceContent.substring(classStartIndex);
    }

    // Clean up TypeScript/CommonJS artifacts using our function
    dataServiceContent = cleanJSContent(dataServiceContent)
        .replace(/utils_service_1\./g, ''); // Additional cleanup for utils-service references

    combinedContent += dataServiceContent + '\n';
}

// Add SettingsService service
const settingsServiceFile = path.join(BUILD_DIR, 'services', 'settings-service.js');
if (fs.existsSync(settingsServiceFile)) {
    console.log('📋 Adding SettingsService service...');
    let settingsServiceContent = fs.readFileSync(settingsServiceFile, 'utf8');

    // Clean up the content - find the class definition start
    const classStartIndex = settingsServiceContent.indexOf('class SettingsService {');
    if (classStartIndex !== -1) {
        settingsServiceContent = settingsServiceContent.substring(classStartIndex);
    }

    // Clean up TypeScript/CommonJS artifacts using our function
    settingsServiceContent = cleanJSContent(settingsServiceContent);

    combinedContent += settingsServiceContent + '\n';
}

// Add InstallDialog component
const installDialogFile = path.join(BUILD_DIR, 'components', 'install-dialog.js');
if (fs.existsSync(installDialogFile)) {
    let installDialogContent = fs.readFileSync(installDialogFile, 'utf8');

    // Clean up the content - find the class definition start
    const classStartIndex = installDialogContent.indexOf('class InstallDialog {');
    if (classStartIndex !== -1) {
        installDialogContent = installDialogContent.substring(classStartIndex);
    }

    // Clean up TypeScript/CommonJS artifacts using our function
    installDialogContent = cleanJSContent(installDialogContent)
        .replace(/data_service_1\./g, '')
        .replace(/utils_service_1\./g, ''); // Additional cleanup for this component

    combinedContent += installDialogContent + '\n';
}

// Add ApplicationInfoDialog component
const applicationInfoDialogFile = path.join(BUILD_DIR, 'components', 'application-info-dialog.js');
if (fs.existsSync(applicationInfoDialogFile)) {
    console.log('📋 Adding ApplicationInfoDialog component...');
    let applicationInfoDialogContent = fs.readFileSync(applicationInfoDialogFile, 'utf8');

    // Clean up the content - find the class definition start
    const classStartIndex = applicationInfoDialogContent.indexOf('class ApplicationInfoDialog {');
    if (classStartIndex !== -1) {
        applicationInfoDialogContent = applicationInfoDialogContent.substring(classStartIndex);
    }

    // Clean up TypeScript/CommonJS artifacts using our function
    applicationInfoDialogContent = cleanJSContent(applicationInfoDialogContent)
        .replace(/utils_service_1\./g, ''); // Additional cleanup for this component

    combinedContent += applicationInfoDialogContent + '\n';
}

// Add ApplicationsList component
const applicationsListFile = path.join(BUILD_DIR, 'components', 'applications-list.js');
if (fs.existsSync(applicationsListFile)) {
    console.log('📋 Adding ApplicationsList component...');
    let applicationsContent = fs.readFileSync(applicationsListFile, 'utf8');

    // Clean up the content - find the class definition start
    const classStartIndex = applicationsContent.indexOf('class ApplicationsList {');
    if (classStartIndex !== -1) {
        applicationsContent = applicationsContent.substring(classStartIndex);
    }

    // Clean up TypeScript/CommonJS artifacts using our function
    applicationsContent = cleanJSContent(applicationsContent)
        .replace(/InstallPackageDialog_js_1\./g, '')
        .replace(/PackageInfoDialog_js_1\./g, '')
        .replace(/utils_service_js_1\./g, '')
        .replace(/application_info_dialog_js_1\./g, '')
        .replace(/data_service_js_1\./g, '');

    combinedContent += applicationsContent + '\n';
}

// Add main application
const mainJsFile = path.join(BUILD_DIR, 'main.js');
if (fs.existsSync(mainJsFile)) {
    console.log('📋 Adding main application...');
    let mainContent = fs.readFileSync(mainJsFile, 'utf8');

    // Clean up the content - find the class definition start
    const classStartIndex = mainContent.indexOf('class ObisionAppsApplication {');
    if (classStartIndex !== -1) {
        mainContent = mainContent.substring(classStartIndex);
    }

    // Clean up TypeScript/CommonJS artifacts using our function
    mainContent = cleanJSContent(mainContent)
        .replace(/applications_list_js_1\.ApplicationsList/g, 'ApplicationsList')
        .replace(/applications_list_js_1\./g, '')
        .replace(/install_dialog_js_1\./g, '')
        .replace(/data_service_js_1\./g, '');

    combinedContent += mainContent + '\n';
}

// Write the final combined file (overwrite main.js)
const appFile = path.join(BUILD_DIR, 'main.js');
fs.writeFileSync(appFile, combinedContent);
fs.chmodSync(appFile, 0o755);

// Copy resources
console.log('📁 Copying resources...');
const dataUiSrc = 'data/ui';
const dataJsonSrc = 'data/applications.json';
const dataUiDest = path.join(BUILD_DIR, 'data/ui');
const dataJsonDest = path.join(BUILD_DIR, 'data/applications.json');
const dataIconsSrc = 'data/icons';
const dataIconsDest = path.join(BUILD_DIR, 'data/icons');
const dataStylesSrc = 'data/styles.css';
const dataStylesDest = path.join(BUILD_DIR, 'data/styles.css');

// Copy styles.css
if (fs.existsSync(dataStylesSrc)) {
    execSync(`cp ${dataStylesSrc} ${dataStylesDest}`, { stdio: 'pipe' });
}

// Copy icons if they exist
if (fs.existsSync(dataIconsSrc)) {
    execSync(`mkdir -p ${path.dirname(dataIconsDest)} && cp -r ${dataIconsSrc} ${path.dirname(dataIconsDest)}/`, { stdio: 'pipe' });
}

if (fs.existsSync(dataUiSrc)) {
    execSync(`mkdir -p ${path.dirname(dataUiDest)} && cp -r ${dataUiSrc} ${path.dirname(dataUiDest)}/`, { stdio: 'pipe' });
}

if (fs.existsSync(dataJsonSrc)) {
    execSync(`cp ${dataJsonSrc} ${dataJsonDest}`, { stdio: 'pipe' });
}

console.log('✅ Build completed successfully!');
console.log(`📦 Application built to: ${appFile}`);
console.log('🚀 Run with: ./builddir/main.js');