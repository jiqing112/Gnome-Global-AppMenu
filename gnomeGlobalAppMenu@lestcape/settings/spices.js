/* ========================================================================================================
 * spices.js - This is a library to handled xlet from the remote source -
 * ========================================================================================================
 */

const Gettext = imports.gettext;
const Lang = imports.lang;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const DownloadManager = cimports.settings.downloadManager;
const Config = cimports.settings.config;
const Repos = cimports.settings.repos;

//const Gettext = imports.gettext.domain(ExtensionUtils.metadata['gettext-domain']);
const _ = Gettext.gettext;

const ABORT_NONE = 0;
const ABORT_ERROR = 1;
const ABORT_USER = 2;

const replacementStrings = [
    {from: 'imports.ui', to: 'cimports.ui'},
    {from: 'imports.misc', to: 'cimports.misc'},
    {from: 'global.settings', to: 'global.cinnamon_settings'},
    {from: 'imports.gi.Cvc', to: 'imports.gi.Gvc'},
    {from: 'imports.gi.Cinnamon', to: 'global.loadCinnamon()'}
];

function isDir(dir) {
    return (dir.query_filesystem_info("standard::type", null).get_file_type() == Gio.FileType.DIRECTORY);
}

function createDir(dir) {
    // FIXME: use glib will be better.
    //Glib.mkdir_with_parents(dir, chmod);
    if(!isDir(dir))
        createDir(dir.get_parent());
    if(!isDir(dir))
        dir.make_directory(null);
}

function removeEmptyFolders(path) {
   let dir = Gio.file_new_for_path(path);
   if (!(dir.query_exists(null) && (dir.query_file_type(Gio.FileQueryInfoFlags.NONE, null) == Gio.FileType.DIRECTORY)))
        return false;

    let fileEnum, info;
    // remove empty subfolders
    fileEnum = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
    while ((info = fileEnum.next_file(null)) != null) {
        if (info.get_file_type() == Gio.FileType.DIRECTORY) {
            removeEmptyFolders(dir.get_child(info.get_name()));
        }
    }
    // if folder empty, delete it
    fileEnum = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
    let files = 0;
    while ((info = fileEnum.next_file(null)) != null) {
        if (info.get_file_type() == Gio.FileType.DIRECTORY) {
            removeEmptyFolders(dir.get_child(info.get_name()));
        }
        files++;
    }
    if (files == 0) {
        //global.log("Removing empty folder:", path);
        file['delete'](null);
        return true;
    }
    return false;
}

function recursivelyDeleteDir(dir) {
    let children = dir.enumerate_children('standard::name,standard::type',
                                          Gio.FileQueryInfoFlags.NONE, null);
    let info, child;
    while ((info = children.next_file(null)) != null) {
        let type = info.get_file_type();
        let child = dir.get_child(info.get_name());
        if (type == Gio.FileType.REGULAR)
            child['delete'](null);
        else if (type == Gio.FileType.DIRECTORY)
            recursivelyDeleteDir(child);
    }
    dir['delete'](null);
}

function recursivelyCopyDir(fromDir, toDir) {
    let children = fromDir.enumerate_children('standard::name,standard::type',
                                              Gio.FileQueryInfoFlags.NONE, null);
    let info, child;
    while ((info = children.next_file(null)) != null) {
        let type = info.get_file_type();
        let child = fromDir.get_child(info.get_name());
        if (type == Gio.FileType.REGULAR) {
            child.copy(toDir.get_child(child.get_basename()), 0, null, function(){});
        } else if (type == Gio.FileType.DIRECTORY) {
            createDir(child);
            recursivelyCopyDir(child);
        }
    }
}

function commondPrefix(parts) {
    return os.path.commonprefix(parts);
}

function changeModeGFile(file, octal) {
    if(file.query_exists(null)) {
        let info = file.query_info("unix::mode", Gio.FileQueryInfoFlags.NONE, null);
        info.set_attribute_uint32("unix::mode", parseInt(octal, 8));
        file.set_attributes_from_info(info, Gio.FileQueryInfoFlags.NONE, null);
    }
}

const SpiceHarvester = new GObject.Class({
    Name: 'ClassicGnome.SpiceHarvester',
    GTypeName: 'ClassicGnomeSpiceHarvester',

    _init: function(collectionType, window) {
        this.loadConfiguration();
        this.collectionType = collectionType;
        this.indexCache = {};
        this.downloadManager = new DownloadManager.DownloaderManager(10);
        this.downloadManager.connect("download-hook", Lang.bind(this, this._onDownloadHook));
        this.downloadManager.connect("download-done", Lang.bind(this, this._onDownloadDone));
        //this.downloadManager.connect("download-error", Lang.bind(this, this._onDownloadError));
        this.error = null;
        this.currentTaskId = null;
        if (!(this.cacheFolder.get_child(this.collectionType).get_child("index.json").query_exists(null)))
            this.hasCache = false;
        else
            this.hasCache = true;

        this.window = window;
        this.builder = new Gtk.Builder();
        this.builder.add_from_file(GLib.build_filenamev([
            global.rootdatadir, "settings", "cinnamon-settings-spice-progress.ui"
        ]));
        this.progressWindow = this.builder.get_object("progress_window");
        this.progressWindow.set_transient_for(this.window);
        this.progressWindow.set_destroy_with_parent(true);
        this.progressWindow.set_modal(true);
        this.progressWindow.set_position(Gtk.WindowPosition.CENTER_ON_PARENT);
        this.progressButtonAbort = this.builder.get_object("btnProgressAbort");
        this.progressWindow.connect("delete-event", Lang.bind(this, this._onProgressClose));
        this.progresslabel = this.builder.get_object('progresslabel');
        this.progressbar = this.builder.get_object("progressbar");
        this.progressbar.set_text('');
        this.progressbar.set_fraction(0);

        this.progressWindow.set_title("");

        this.abortDownload = ABORT_NONE;
        this.downloadTotalFiles = 0;
        this.downloadCurrentFiles = 0;
        this._sigLoadFinished = null;

        this.progressButtonAbort.connect("clicked", Lang.bind(this, this._onAbortClicked));

        this.spiceDetail = new Gtk.Dialog({
           title: _("Applet info"),
           transient_for: this.window,
           modal: true,
           destroy_with_parent: true
        });
        this.spiceDetailSelectButton = this.spiceDetail.add_button(_("Select and Close"), Gtk.ResponseType.YES);
        this.spiceDetailSelectButton.connect("clicked", Lang.bind(this, this.closeSelectDetail));
        this.spiceDetailCloseButton = this.spiceDetail.add_button(_("Close"), Gtk.ResponseType.CANCEL);
        this.spiceDetailCloseButton.connect("clicked", Lang.bind(this, this.closeDetail));
        this.spiceDetail.connect("destroy", Lang.bind(this, this._onCloseDetail));
        this.spiceDetail.connect("delete_event", Lang.bind(this, this._onCloseDetail));
        this.spiceDetail.set_default_size(640, 440);
        this.spiceDetail.set_size_request(640, 440);
        //FIXME: This help?
        //contentArea = this.spiceDetail.get_content_area();
    },

    _onDownloadHook: function(manager, job, downloadSize, downloadLength) {
        if (manager.getNumberOfJobs() == 1) {
            let fraction = parseFloat(downloadSize)/parseFloat(downloadLength);
            this.progressbar.set_text("%s - %d / %d files".format(Math.floor(fraction*100).toString() + '%', downloadSize, downloadLength));
            if (fraction > 0)
                this.progressbar.set_fraction(fraction);
            else
                this.progressBarPulse();
            while (Gtk.events_pending()) {
                Gtk.main_iteration();
            }
        }

    },

    _onDownloadDone: function(manager, job, downloadSize, downloadLength) {
        if (downloadSize > 1) {
            let fraction = parseFloat(downloadSize)/parseFloat(downloadLength);
            this.progressbar.set_text("%s - %d / %d files".format(Math.floor(fraction*100).toString() + '%', downloadSize, downloadLength));
            if (fraction > 0)
                this.progressbar.set_fraction(fraction);
            else
                this.progressBarPulse();
            while (Gtk.events_pending()) {
                Gtk.main_iteration();
            }
        }
    },

    _onDownloadError: function(manager, job, errorStatusCode) {
        global.log("Download Error: Soup.Status.Code " +  errorStatusCode);
    },

    loadConfiguration: function() {
        this.homeFolder = Gio.file_new_for_path(GLib.get_home_dir());
        this.userDirFolder = Gio.file_new_for_path(GLib.get_user_data_dir());
        this.domainFolder = this.homeFolder.get_child(Config.USER_DOMAIN_FOLDER);//Don't used global
        this.configFolder = this.domainFolder.get_child(Config.USER_CONFIG_FOLDER);
        this.cacheFolder = this.domainFolder.get_child(Config.USER_CACHE_FOLDER);
        this.repoFolder = this.domainFolder.get_child(Config.USER_REPOSITORIES_FOLDER);
        this.localeFolder = this.userDirFolder.get_child(Config.USER_LOCALE_FOLDER);
        this.installFolder = this.userDirFolder.get_child(Config.USER_INSTALL_FOLDER);
        this.loadRepositories();
    },

    loadRepositories: function() {
        this.repositories = Repos.DEFAULT_REPOSITORIES;
        if(this.repoFolder.query_exists(null)) {
            //load others
        }
    },

    closeSelectDetail: function() {
        this.spiceDetail.hide();
        if (this.hasOwnProperty('_onDetailSelect'))
            this._onDetailSelect(this);
    },

    _onCloseDetail: function(args) {
        this.closeDetail();
        return true;
    },

    closeDetail: function() {
        this.spiceDetail.hide();
        if (this.hasOwnProperty('_onDetailClose'))
            this._onDetailClose(this);
    },

    _systemCall: function(cmd) {
        try {
            let [success, argv] = GLib.shell_parse_argv(cmd);
            if(success) {
                GLib.spawn_async(null, argv, null,
                                 GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.STDOUT_TO_DEV_NULL  | GLib.SpawnFlags.STDERR_TO_DEV_NULL,
                                 null, null);
            }
        } catch (e) {}
    },

    showDetail: function(uuid, onSelect, onClose) { // onSelect=null, onClose=null
        this._onDetailSelect = onSelect;
        this._onDetailClose = onClose;

        if (!this.hasCache)
            this.refreshCache(false);
        else if (this.indexCache.length == 0)
            this.loadCache();

        if (!(uuid in this.indexCache)) {
            this.load(Lang.bind(this, function(obj, uuid) {
                this.showDetail(uuid);
            }, uuid));
            return;
        }

        let appletData = this.indexCache[uuid];

        // Browsing the info within the app would be great (ala mintinstall)
        // and it gives a better experience (layout, comments, reviewing) than
        // browsing online
        let server = this.repositories["default"].server_url;
        this._systemCall("xdg-open '%s/%ss/view/%s'".format(server, this.collectionType, appletData['spices-id']));
        return;

        // screenshotFilename = Gio.file_new_for_path(appletData['screenshot']).get_basename();
        // screenshotPath = GLib.build_filenamev([this.cacheFolder.get_child(this.collectionType).get_path(), screenshotFilename]);
        // appletData['screenshot_path'] = screenshotPath;
        // appletData['screenshot_filename'] = screenshotFilename;

        // if (!Gio.file_new_for_path(screenshotPath).query_exists(null)) {
        //     f = open(screenshotPath, 'w');
        //     this.downloadURL = server + appletData['screenshot'];
        //     this.downloadWithProgressbar(f, screenshotPath, _("Downloading screenshot"), false);
        // }
        // let htmlDetails = GLib.build_filenamev([
        //     global.rootdatadir, "settings", "spices" "applet-detail.html"
        // ])
        // template = GLib.file_get_contents(htmlDetails);
        // subs = {};
        // subs['appletData'] = JSON.stringify(appletData, null, 4);
        // html = string.Template(template).safe_substitute(subs);

        // // Prevent flashing previously viewed
        // this._sigLoadFinished = this.browser.connect("document-load-finished", Lang.bind(this, this.realShowDetail));
        // this.browser.load_html_string(html, "file:///");
    },

    realShowDetail: function() {
        this.browser.show();
        this.spiceDetail.show();
        this.browser.disconnect(this._sigLoadFinished);
    },

    browserTitleChanged: function(view, frame, title) {
        let uuid;
        if (title.startswith("nop"))
            return;
        else if (title.startswith("install:"))
            uuid = title.split(':')[1];
            //this.install(uuid);
        else if (title.startswith("uninstall:"))
            uuid = title.split(':')[1];
            //this.uninstall(uuid, '');
        return;
    },

    browserConsoleMessage: function(view, msg, line, sourceid) {
        //global.log(msg);
    },

    getIndexURL: function() {
        let server = this.repositories["default"].server_url;
        let index = this.repositories["default"].collections[this.collectionType].index;
        return server + index;
    },

    getCacheFolder: function() {
        return this.cacheFolder;
    },

    getInstallFolder: function() {
        if (this.collectionType == 'theme') {
            return this.homeFolder.get_child(".themes");
        }
        return this.installFolder;
    },

    load: function(onDone, force) {
        this.abortDownload = ABORT_NONE;
        force = (force == true);
        if (this.hasCache && !force) {
            this.loadCache();
            onDone(this.indexCache);
        } else {
            this.progresslabel.set_text(_("Refreshing index..."));
            this.progressWindow.show();
            this.progressbar.set_fraction(0);
            this.progressBarPulse();
            this.refreshCacheDoneCallback = onDone;
            this.refreshCache();
        }
    },

    refreshCache: function(loadAssets) { // loadAssets=true
        if(!this.currentTaskId) {
            if(loadAssets !== false)
                loadAssets = true;
            let downloadURL = this.getIndexURL();
            let filename = this.cacheFolder.get_child(this.collectionType).get_child("index.json");
            let job = new DownloadManager.DownloadJob(downloadURL, filename);
            this.downloadManager.clearAll();
            this.downloadManager.addJob(job);
            this.currentTaskId = this.downloadManager.connect("download-finished", Lang.bind(this, this._onIndexDownload, loadAssets));
            this.downloadManager.startDownloads();
            //this.download(filename, downloadURL);
        }
    },

    _onIndexDownload: function(manager, loadAssets) {
       if(this.currentTaskId) {
           manager.disconnect(this.currentTaskId);
           this.currentTaskId = null;
           manager.clearAll();
       }
       this.loadCache();
       // global.log("Loaded index, now we know about %d spices.".format(this.indexCache.length));
        if (loadAssets) {
            this.progresslabel.set_text(_("Refreshing cache..."));
            this.progressButtonAbort.set_sensitive(true);
            this.loadAssets();
        }
    },

    loadCache: function() {
        let jsonFile = this.cacheFolder.get_child(this.collectionType).get_child("index.json");
        try {
            let [ok, json_data] = GLib.file_get_contents(jsonFile.get_path());
            this.indexCache = JSON.parse(json_data);
        } catch(e) {
            try {
                jsonFile['delete'](null);
            } catch(e) {}
            this.errorMessage(_("Something went wrong with the spices download.  Please try refreshing the list again."), e.message);
        }
    },

    loadAssets: function() {
        let needsRefresh = 0;
        this.usedThumbs = [];

        let iconBasename, iconFile, icon_path;
        for (let uuid in this.indexCache) {
            if (this.collectionType == "theme") {
                iconBasename = this.sanitizeThumb(
                    Gio.file_new_for_path(this.indexCache[uuid]['screenshot']).get_basename()
                );
                iconFile = this.cacheFolder.get_child(this.collectionType).get_child(iconBasename);
                this.usedThumbs.push(iconBasename);
            } else {
                iconBasename = Gio.file_new_for_path(this.indexCache[uuid]['icon']).get_basename();
                iconFile = this.cacheFolder.get_child(this.collectionType).get_child(iconBasename);
                this.usedThumbs.push(iconBasename);
            }
            this.indexCache[uuid]['icon_filename'] = iconBasename;
            this.indexCache[uuid]['icon_path'] = iconFile.get_path();

            if ((iconFile.query_file_type(Gio.FileQueryInfoFlags.NONE, null) == Gio.FileType.REGULAR) ||
                this.isBadImage(iconFile.get_path())) {
                needsRefresh += 1;
            }
        }
        let jsonFile = this.cacheFolder.get_child(this.collectionType).get_child("index.json");
        let rawMeta = JSON.stringify(this.indexCache, null, 4);
        GLib.file_set_contents(jsonFile.get_path(), rawMeta);

        this.downloadTotalFiles = needsRefresh;
        this.downloadCurrentFiles = 0;
        let needToDownload = false;
        this.downloadManager.clearAll();
        for (let uuid in this.indexCache) {
            if (this.abortDownload > ABORT_NONE)
                return;
            iconFile = Gio.file_new_for_path(this.indexCache[uuid]['icon_path']);
            if ((iconFile.query_file_type(Gio.FileQueryInfoFlags.NONE, null) == Gio.FileType.REGULAR) ||
                this.isBadImage(iconFile.get_path())) {
                needToDownload = true;
                //this.progressBarPulse();
                this.downloadCurrentFiles += 1;
                let downloadURL = "";
                let server = this.repositories["default"].server_url;
                let assets = this.repositories["default"].collections[this.collectionType].assets;
                if (this.collectionType == "theme")
                    downloadURL = "%s%s%s".format(server, assets, this.indexCache[uuid]['icon_filename']);
                else
                    downloadURL = "%s/%s".format(server, this.indexCache[uuid]['icon']);
                let job = new DownloadManager.DownloadJob(downloadURL, iconFile);
                this.downloadManager.addJob(job);
            }
        }
        if (!needToDownload) {
            this._onLoadAssetsDone(this.downloadManager);
        } else if(!this.currentTaskId) {
            this.currentTaskId = this.downloadManager.connect("download-finished", Lang.bind(this, this._onLoadAssetsDone));
            this.downloadManager.startDownloads();
        }
    },

    isBadImage: function(path) {
        try {
            let file = Gio.file_new_for_path(path);
            if(!file.query_exists(null))
                return true;
            let gicon = new Gio.FileIcon({file: file});
        } catch (e) {
            return true;
        }
        return false;
    },

    _onLoadAssetsDone: function(manager) {
        if(this.currentTaskId) {
            manager.disconnect(this.currentTaskId);
            this.currentTaskId = null;
            manager.clearAll();
        }
        // Cleanup obsolete thumbs
        let trash = [];
        let fileEnum, info;
        let dir = this.cacheFolder.get_child(this.collectionType);
        fileEnum = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
        while ((info = fileEnum.next_file(null)) != null) {
            let f = info.get_name()
            if (!(f in this.usedThumbs) && (f != "index.json")) {
                trash.push(f);
            }
        }
        for (let t in trash) {
            try {
                dir.get_child(t)['delete'](null);
            } catch(e) {
                continue;
            }
        }
        this.progressWindow.hide();
        this.refreshCacheDoneCallback(this.indexCache);
        this.downloadTotalFiles = 0;
        this.downloadCurrentFiles = 0;
    },

    sanitizeThumb: function(basename) {
        return basename.replace("jpg", "png").replace("JPG", "png").replace("PNG", "png");
    },

    getMembers: function(zip) {
        let parts = [];
        for (let name in zip.namelist()) {
            if (!name.endswith('/')) {
                parts.push(name.split('/'));
            }
        }
        let prefix = (this.commondPrefix(parts) || '');
        if (prefix)
            prefix = '/'.join(prefix) + '/';
        let offset = prefix.length;
        let name;
        for (let zipinfo in zip.infolist()) {
            name = zipinfo.filename;
            if (name.length > offset) {
                //zipinfo.filename = name[offset:];
                yield zipinfo;
            }
        }
    },

    spawnCommand: function(command, callback, errback) {
        if (typeof command === 'string') {
            command = command.split(' ')
        }
        let [success, pid] = GLib.spawn_async(null,
                                              command,
                                              null,
                                              GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
                                              null);
        if (!success) {
            errback();
            return;
        }
        GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, function(pid, status) {
            GLib.spawn_close_pid(pid);

            if (status !== 0) {
                if (typeof errback === 'function') {
                    errback();
                }
            } else {
                if (typeof callback === 'function') {
                    callback();
                }
            }
        });
    },

    installAll: function(installList, onFinished) {// installList=[], onFinished=null
        let success = false;
        let server = this.repositories.default.server_url;
        let filename = GLib.get_tmp_dir();
        let tempfile = GLib.build_filenamev([filename, "temp"]);

        this.downloadManager.clearAll();
        this.uiInstallingXlet("");
        for (let cuuid in installList) {
            let [uuid, isUpdate, isActive] = installList[cuuid];
            let downloadURL = server + this.indexCache[uuid].file;
            let xletFile = Gio.file_new_for_path(tempfile + '/' + this.indexCache[uuid].name + '.zip')
            let job = new DownloadManager.DownloadJob(downloadURL, xletFile);
            this.downloadManager.addJob(job);
        }
        if(!this.currentTaskId) {
            this.currentTaskId = this.downloadManager.connect("download-finished", 
                Lang.bind(this, this._onXletsDonwload, installList, onFinished, tempfile));
            this.downloadManager.startDownloads();
        }
    },

    _onXletsDonwload: function(manager, installList, onFinished, tempfile) {
        if(this.currentTaskId) {
            manager.disconnect(this.currentTaskId);
            this.currentTaskId = null;
            manager.clearAll();
        }
        let needRestart = [];
        for (let cuuid in installList) {
            let [uuid, isUpdate, isActive] = installList[cuuid];
            let success = this.install(uuid, isUpdate, isActive, tempfile);
            if (isUpdate && isActive && success)
                needRestart.push(uuid);
        }
        this.progressWindow.hide();
        this.abortDownload = false;

        onFinished(needRestart);
    },

    install: function(uuid, isUpdate, isActive, tempfile) {
        //global.log("Start downloading and installation");
        //global.log('this.indexCache', JSON.stringify(this.indexCache))
        let title = this.indexCache[uuid].name;
        this.uiInstallingXlet(title);
        let server = this.repositories.default.server_url;
        this.currentUUID = uuid;
        let editedDate = this.indexCache[uuid].last_edited;

        this.downloadTotalFiles = 0;
        this.downloadCurrentFiles = 0;
        this.progressWindow.hide();
        this.abortDownload = false;

        if (this.collectionType != "theme") {
            //let dirname = GLib.mkdtemp(tempfile); // null
            let xletFile = Gio.file_new_for_path(tempfile).get_child(this.indexCache[uuid].name + '.zip');
            try {
                //this.download(dirname, filename, downloadURL);
                let installPath = this.installFolder.get_child(this.collectionType + 's');
                let installDest = installPath.get_child(uuid);
                let tempXletDir = xletFile.get_parent().get_child(uuid);

                // Arrow function used to bind `this`.
                this.spawnCommand(['unzip', '-od', tempXletDir.get_path(), '--', xletFile.get_path()], ()=> {
                    let patchJSFiles = (_tempXletDir)=>{
                        let fileEnum, info;
                        fileEnum = _tempXletDir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
                        while ((info = fileEnum.next_file(null)) !== null) {
                            let f = info.get_name();

                            // Workaround UUID directories inside the zip file breaking the path set for patching.
                            global.log(f);
                            if (f.indexOf('@') !== -1) {
                                tempXletDir = tempXletDir.get_child(uuid);
                                patchJSFiles(tempXletDir);
                                return false;
                            }
                            // Patch the javascript files for compatibility with our patched namespacing.
                            // Check if it the file name ends with a .js extension.
                            if (f.substr(f.length - 3) === '.js') {
                                let jsFilePath = _tempXletDir.get_path() + '/' + f;
                                let [ok, fileContents] = GLib.file_get_contents(jsFilePath)
                                fileContents = fileContents.toString();
                                for (let i = 0; i < replacementStrings.length; i++) {
                                    let re = new RegExp(replacementStrings[i].from, 'g');
                                    fileContents = fileContents.replace(re, replacementStrings[i].to)
                                }
                                //global.log(fileContents)
                                let success = GLib.file_set_contents(jsFilePath, fileContents);
                                if (!success) {
                                    throw new Error('There was an error patching a JS file: ', jsFilePath);
                                }
                            }
                        }
                        return false;
                    };

                    patchJSFiles(tempXletDir)

                    // Couldn't get recursivelyCopyDir to work, so falling back to this.
                    let copyToUserXletDir = ()=>{
                        this.spawnCommand(['cp', '-avrf', tempXletDir.get_path(), installPath.get_path()], ()=>{
                            global.log('Copy complete.');
                            // Sometimes the zip files have a directory inside it, this will not be detected by the search path.
                            let redundantXletDir = installPath.get_child(uuid).get_child(uuid);
                            if (redundantXletDir.query_exists(null)) {
                                global.log('Correcting redundant installation path.')
                                this.spawnCommand(['cp', '-avrf', redundantXletDir.get_path(), installPath.get_path()], ()=>{
                                    this.spawnCommand(['rm', '-rf', redundantXletDir.get_path()], ()=>{
                                        return true;
                                    });
                                });
                            }
                            return true;
                        });
                    };
                    if (!installDest.query_exists(null)) {
                        copyToUserXletDir();
                    } else {
                        this.spawnCommand(['rm', '-rf', installDest.get_path()], ()=>{
                            global.log('Refreshed xlet cache.');
                            copyToUserXletDir();
                        });
                    }
                }, function(err) {
                    global.logError(err);
                });
                /*let schemaFilename = "";*/

                // zipfile is a python utility
                /*let zip = zipfile.ZipFile(filename);
                zip.extractall(dirname, this.getMembers(zip));
                for (let file in this.getMembers(zip)) {
                    //if (!file.filename.endswith('/')) {
                    //    changeModeGFile(Gio.file_new_for_path(GLib.build_filenamev([dirname, file.filename]), 755));
                    //} else if (file.filename[:3] == 'po/') {
                    //    parts = os.path.splitext(file.filename);
                    //    if (parts[1] == '.po') {
                    //       this_locale_dir = this.localeFolder.get_child(parts[0].substring(3, parts[0].length)).get_child('LC_MESSAGES');
                    //       this.progresslabel.set_text(_("Installing translations for %s...").format(title));
                    //       rec_mkdir(this_locale_dir);
                    //       //global.log("/usr/bin/msgfmt -c %s -o %s".format(dest.get_child(file.filename).get_path(), GLib.build_filenamev([this_locale_dir, "%s.mo".format(uuid)])));
                    //       subprocess.call(["msgfmt", "-c", GLib.build_filenamev([dirname, file.filename]), "-o", GLib.build_filenamev([this_locale_dir, "%s.mo".format(uuid)])]);
                    //       this.progresslabel.set_text(_("Installing %s...").format(title));
                    //    }
                    //} else 
                    if ("gschema.xml" in file.filename) {
                        let installerPath = GLib.build_filenamev([global.rootdatadir, "tools", "schemaInstaller.js"]);
                        if (Gio.file_new_for_path(installerPath).query_exists(null)) {
                            schemaFilename = file.get_basename();
                            let command = "%s -i \"%s\"".format(installerPath, GLib.build_filenamev([dirname, schemaFilename]));
                            this._systemCall(command);
                        } else {
                            this.errorMessage(_("Could not install the settings schema for %s.  You will have to perform this step yourthis.").format(uuid));
                        }
                    }
                }
                let jsonFile = GLib.build_filenamev([dirname, "metadata.json"]);
                let [ok, rawMeta] = GLib.file_get_contents(jsonFile);
                let md = JSON.parse(rawMeta);
                md["last-edited"] = editedDate;
                if (schemaFilename != "")
                    md["schema-file"] = schemaFilename;
                rawMeta = JSON.stringify(md, null, 4);
                GLib.file_set_contents(jsonFile, rawData);
                if (dest.query_exists(null)) {
                    recursivelyDeleteDir(dest);
                }
                recursivelyCopyDir(dirname, dest);
                recursivelyDeleteDir(dirname);
                Gio.file_new_for_path(filename)['delete'](null);*/

                /*if (installListLen - 1 > r) {
                    this.extensionSidePage.install_extensions(null, ++r);
                } else {
                    this.downloadManager.startDownloads();
                }*/
            } catch(ge) {
                global.logError(ge);
                global.logError(ge.stack.substr(ge.stack.indexOf('\n') + 1))
                this.progressWindow.hide();
                try {
                    recursivelyDeleteDir(dirname);
                    Gio.file_new_for_path(filename)['delete'](null);
                } catch(e) {}
                if (!this.abortDownload) {
                    let msg = _("An error occurred during installation or updating. \
                              You may wish to report this incident to the developer of %s.\n\n\
                              If this was an update, the previous installation is unchanged").format(uuid);
                    this.errorMessage(msg, ge.message.toString());
                }
                return false;
            }
        } else {
            let filename = GLib.get_tmp_dir();
            let tempfile = GLib.build_filenamev([filename, "temp"]);
            let dirname = Glib.mkdtemp(tempfile);
            try {
                this.download(dirname, filename, downloadURL);
                let zip = zipfile.ZipFile(filename);
                zip.extractall(dirname);

                // Check dir name - it may or may not be the same as the theme name from our spices data
                // Regardless, this will end up being the installed theme name, whether it matched or not
                let tempPath = GLib.build_filenamev([dirname, title]);
                if (!Gio.file_new_for_path(tempPath).query_exists(null)) {
                    title = this._listdir(dirname)[0]; // We assume only a single folder, the theme name
                    tempPath = GLib.build_filenamev([dirname, title]);
                }
                // Test for correct folder structure - look for cinnamon.css
                let filePath = GLib.build_filenamev([tempPath, "cinnamon", "cinnamon.css"]);
                if(!Gio.file_new_for_path(filePath).query_exists(null))
                    throw Error("We can not loacalized the file 'cinnamon.css' in the source package");

                let md = {};
                md["last-edited"] = editedDate;
                md["uuid"] = uuid;
                let rawMeta = JSON.stringify(md, null, 4);
                filePath = GLib.build_filenamev([tempPath, "cinnamon", "metadata.json"]);
                GLib.file_set_contents(filePath, rawMeta);

                let finalPath = this.installFolder.get_child(title);
                if (finalPath.query_exists(null))
                    recursivelyDeleteDir(finalPath);
                recursivelyCopyDir(Gio.file_new_for_path(tempPath), finalPath);
                recursivelyDeleteDir(Gio.file_new_for_path(dirname));
                Gio.file_new_for_path(filename)['delete'](null);
            } catch(eg) {
                this.progressWindow.hide();
                try {
                    recursivelyDeleteDir(Gio.file_new_for_path(dirname));
                    Gio.file_new_for_path(filename)['delete'](null);
                } catch(e) {}
                if (this.collectionType == "theme")
                    obj = title;
                else
                    obj = uuid;
                if (!this.abortDownload) {
                    let msg = _("An error occurred during installation or updating. \
                              You may wish to report this incident to the developer of %s.\n\n\
                              If this was an update, the previous installation is unchanged").format(obj);
                    this.errorMessage(msg, eg.toString());
                }
                return false;
            }
        }
        this.progressButtonAbort.set_sensitive(false);
        this.progressWindow.show();
        return true;
    },

    uiInstallingXlet: function(title) {
        this.progressWindow.show();
        this.progresslabel.set_text(_("Installing %s...").format(title));
        this.progressbar.set_fraction(0);
    },

    uninstall: function(uuid, name, schemaFilenamee, onFinished) {//onFinished=null
        this.uiUninstallingXlet(name);

        let installPath = this.installFolder.get_path() + '/' + this.collectionType + 's';
        let installDest = Gio.file_new_for_path(installPath + '/' + uuid)
        try {
            if (this.collectionType != "theme") {
                if (schemaFilename != "") {
                    let sentence = _("Please enter your password to remove the settings schema for %s").format(uuid);
                    let installerPath = GLib.build_filenamev([global.rootdatadir, "tools", "schemaInstaller.js"]);
                    if (Gio.file_new_for_path(installerPath).query_exists(null)) {
                        schemaFilename = file.get_basename();
                        let command = "%s -u \"%s\"".format(installerPath, GLib.build_filenamev([dirname, schemaFilename]));
                        this._systemCall(command);
                    } else {
                        this.errorMessage(_("Could not remove the settings schema for %s. \
                                             You will have to perform this step yourthis. \
                                             This is not a critical error.").format(uuid));
                    }
                }
                recursivelyDeleteDir(installDest);
                // Uninstall spice localization files, if any
                if (this.localeFolder.query_exists(null)) {
                    let i19Folders = this._listdir(this.localeFolder);
                    for (let pos in i19Folders) {
                        let i19Folder = i19Folders[pos];
                        let moFile = this.localeFolder.get_child(i19Folder).get_child('LC_MESSAGES').get_child("%s.mo".format(uuid));
                        if (moFile.query_exists(null)) {
                            if (moFile.query_filesystem_info("standard::type", null).get_file_type() == Gio.FileType.REGULAR) {
                                moFile['delete'](null);
                            }
                            // Clean-up this locale folder
                            removeEmptyFolders(this.localeFolder.get_child(i19Folder));
                        }
                    }
                }
                // Uninstall settings file, if any
                let settingDir = this.configFolder.get_child(uuid);
                if (settingDir.query_exists(null))
                    recursivelyDeleteDir(settingDir);
            } else {
                recursivelyDeleteDir(this.installFolder.get_child(name));
            }
        } catch(e) {
            global.logError(e);
            global.logError(e.stack.substr(e.stack.indexOf('\n') + 1))
            this.progressWindow.hide();
            this.errorMessage(_("Problem uninstalling %s.  You may need to manually remove it.").format(uuid), e);
        }
        this.progressWindow.hide();
        if(onFinished) //can be null.
            onFinished(uuid);
    },

    uiUninstallingXlet: function(name) {
        this.progresslabel.set_text(_("Uninstalling %s...").format(name));
        this.progressWindow.show();
        this.progressBarPulse();
    },

    _onAbortClicked: function(button) {
        this.downloadManager.stopAll();
        this.abortDownload = ABORT_USER;
        this.progressWindow.hide();
        return;
    },

    // downloadWithProgressbar: function(outfd, outfile, caption, waitForClose) { //caption='Please wait..', waitForClose=true
    //     this.progressbar.set_fraction(0);
    //     this.progressbar.set_text('0%');
    //     this.progresslabel.set_text(caption);
    //     this.progressWindow.show();

    //     while Gtk.events_pending() {
    //         Gtk.main_iteration();
    //     }

    //     this.progressBarPulse();
    //     this.download(outfd, outfile);

    //     if (!waitForClose) {
    //         time.sleep(0.5);
    //         this.progressWindow.hide();
    //     } else {
    //         this.progressButtonAbort.set_sensitive(false);
    //     }
    // },

    progressBarPulse: function() {
        let count = 0;
        this.progressbar.set_pulse_step(0.1);
        while (count < 1) {
            //time.sleep(0.1);
            this.progressbar.pulse();
            count += 1;
            while (Gtk.events_pending()) {
                Gtk.main_iteration();
            }
        }
    },

    download: function(outfile, url) {
        this.progressButtonAbort.set_sensitive(true);
        try {
            this.urlRetrieve(url, outfile, this.reporthook);
        } catch(ge) {
            global.logError(ge);
            try {
                outfile['delete'](null);
            } catch(e) {}
            this.progressWindow.hide();
            if (this.abortDownload == ABORT_ERROR)
                this.errorMessage(_("An error occurred while trying to access the server.  Please try again in a little while."), this.error);
            throw Error(_("Download aborted."));
        }
        return outfile;
    },

    reporthook: function(count, blockSize, totalSize) {
        let fraction = 0
        if (this.downloadTotalFiles > 1) {
            fraction = 1.0 - (parseFloat(this.downloadManager.get_n_jobs()) / parseFloat(this.downloadTotalFiles));
            this.progressbar.set_text("%s - %d / %d files".format(parseInt(fraction*100).toString() + '%', this.downloadTotalFiles - this.downloadManager.get_n_jobs(), this.downloadTotalFiles));
        } else {
            fraction = count * blockSize / parseFloat((totalSize / blockSize + 1) * (blockSize));
            this.progressbar.set_text(parseInt(fraction * 100).toString() + '%');
        }
        if (fraction > 0)
            this.progressbar.set_fraction(fraction);
        else
            this.progressBarPulse();

        while (Gtk.events_pending()) {
            Gtk.main_iteration();
        }
    },

    urlRetrieve: function(url, file, reporthook) {
        //Like the one in urllib. Unlike urllib.retrieve urlRetrieve
        //can be interrupted. KeyboardInterrupt exception is rasied when
        //interrupted.
        let count = 0;
        let blockSize = 1024 * 8;
        try {
            /*let urlobj = urllib2.urlopen(url);
            //assert urlobj.getcode() == 200;
            let data;
            let totalSize = parseInt(urlobj.info()['content-length']);
            try {
                while (this.abortDownload == ABORT_NONE) {
                    data = urlobj.read(blockSize);
                    count += 1;
                    if (!data)
                        break;
                    f.write(data);
                    reporthook(count, blockSize, totalSize);
                }
            } catch(e) {
                f.close();
                this.abortDownload = ABORT_USER;
            }*/
            //delete urlobj;
        } catch(e) {
            f.close();
            this.abortDownload = ABORT_ERROR;
            this.error = detail;
            throw KeyboardInterrupt;
        }

        if (this.abortDownload > ABORT_NONE)
            throw KeyboardInterrupt;
        f.close();
    },

    _listdir: function(directory) {
        let info;
        let result = new Array();
        let fileEnum = directory.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);
        while ((info = fileEnum.next_file(null)) != null) {
            if (info.get_file_type() == Gio.FileType.DIRECTORY) {
                result.push(info.get_name());
            }
        }
        return result;
    },

    scrubConfigDirs: function(enabledList) {
        let activeList = {};
        let fn, dirList, idList, panel, align, order, uuid, id, x, y;
        for (let enabled in enabledList) {
            if (this.collectionType == "applet") {
                [panel, align, order, uuid, id] = enabled.split(":");
            } else if (this.collectionType == "desklet") {
                [uuid, id, x, y] = enabled.split(":");
            } else {
                uuid = enabled;
                id = 0;
            }
            if (!(uuid in activeList)) {
                idList = [];
                activeList[uuid] = idList;
                activeList[uuid].push(id);
            } else {
                activeList[uuid].push(id);
            }
        }
        for (let uuid in activeList) {
            if (this.configFolder.get_child(uuid).query_exists(null)) {
                dirList = this._listdir(this.configFolder.get_child(uuid));
                fn = "%s.json".format(uuid);
                if ((fn in dirList) && (dirList.length == 1))
                    dirList.remove(fn);
                for (let id in activeList[uuid]) {
                    fn = "%s.json".format(id);
                    if (fn in dirList)
                        dirList.remove(fn);
                }
                for (let jetsam in dirList) {
                    try {
                        this.configFolder.get_child(uuid).get_child(jetsam)['delete'](null);
                    } catch(e) {
                        continue;
                    }
                }
            }
        }
    },

    uiErrorMessage: function(msg, detail) { //detail = null
        let dialog = new Gtk.MessageDialog({
            transient_for: this.window,
            modal: true,
            message_type: Gtk.MessageType.ERROR,
            buttons: Gtk.ButtonsType.OK
        });
        let markup = msg;
        if (detail != null)
            markup += _("\n\nDetails:  %s").format(detail.toString());
        //let esc = cgi.escape(markup);
        dialog.set_markup(markup);
        dialog.show_all();
        //response = dialog.run();
        dialog.run();
        dialog.destroy();
    },

    errorMessage: function(msg, detail) { // detail=null
        this.uiErrorMessage(msg, detail);
    },

    _onProgressClose: function(widget, event) {
        this.abortDownload = true;
        return widget.hide_on_delete();
    },
});
