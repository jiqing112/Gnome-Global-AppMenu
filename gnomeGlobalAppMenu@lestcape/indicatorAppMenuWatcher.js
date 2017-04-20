// Copyright (C) 2014-2015 Lester Carballo Pérez <lestcape@gmail.com>
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Shell = imports.gi.Shell;
const Meta = imports.gi.Meta;

const Lang = imports.lang;
const Signals = imports.signals;

const Main = imports.ui.main;
const Util = imports.misc.util;


const MyExtension = imports.misc.extensionUtils.getCurrentExtension();
const DBusMenu = MyExtension.imports.dbusMenu;
const DBusRegistrar = DBusMenu.loadInterfaceXml("DBusRegistrar.xml");

const FILE_PATH = MyExtension.dir.get_path();

const WATCHER_INTERFACE = 'com.canonical.AppMenu.Registrar';
const WATCHER_OBJECT = '/com/canonical/AppMenu/Registrar';

const AppmenuMode = {
   MODE_STANDARD: 0,
   MODE_UNITY: 1,
   MODE_UNITY_ALL_MENUS: 2
};

const LOG_NAME = "Indicator AppMenu Whatcher:";

//Some GTK APP that use Register iface or not export the menu.
const GTK_BLACKLIST = [
   "firefox.desktop",
   "thunderbird.desktop",
   "blender-fullscreen.desktop",
   "blender-windowed.desktop"
];

function SystemProperties() {
   this._init.apply(this, arguments);
}

SystemProperties.prototype = {

   _init: function() {
      this._environmentCallback = null;
      this.xSetting = new Gio.Settings({ schema: 'org.gnome.settings-daemon.plugins.xsettings' });
   },

   shellShowAppmenu: function(show) {
      this._overrideBoolXSetting('Gtk/ShellShowsAppMenu', show);
   },

   shellShowMenubar: function(show) {
      this._overrideBoolXSetting('Gtk/ShellShowsMenubar', show);
   },

   activeJAyantanaModule: function(active) {
      if(active) {
         let file = Gio.file_new_for_path("/usr/share/java/jayatanaag.jar");
         if(file.query_exists(null)) {
             let envJavaToolOptions = this._getEnvJavaToolOptions();
             GLib.setenv('JAYATANA', "1", true);
             GLib.setenv('JAYATANA_FORCE', "1", true);
             let jayantana = "-javaagent:/usr/share/java/jayatanaag.jar";
             if(envJavaToolOptions.indexOf(jayantana) == -1)
                 envJavaToolOptions.push(jayantana);
             GLib.setenv('JAVA_TOOL_OPTIONS', envJavaToolOptions.join(" "), true);
          }
      } else {
          GLib.setenv('JAYATANA', "0", true);
          GLib.setenv('JAYATANA_FORCE', "0", true);
          let envJavaToolOptions = this._getEnvJavaToolOptions();
          let jayantana = "-javaagent:/usr/share/java/jayatanaag.jar";
          let index = envJavaToolOptions.indexOf(jayantana);
          if(index != -1) {
             envJavaToolOptions.splice(index, -1);
          }
          GLib.setenv('JAVA_TOOL_OPTIONS', envJavaToolOptions.join(" "), true);
      }
   },

   activeUnityGtkModule: function(active) {
      let isReady = false;
      let envGtk = this._getEnvGtkModules();
      let xSettingGtk = this._getXSettingGtkModules();
      if(active) {
         if(envGtk) {
            if(envGtk.indexOf("unity-gtk-module") == -1) {
               envGtk.push("unity-gtk-module");
               this._setEnvGtkModules(envGtk);
            } else {
               isReady = true;
            }
         } else  {
            envGtk = ["unity-gtk-module"];
            this._setEnvGtkModules(envGtk);
         }
         if(xSettingGtk) {
            if(xSettingGtk.indexOf("unity-gtk-module") == -1) {
               xSettingGtk.push("unity-gtk-module");
               this._setXSettingGtkModules(xSettingGtk);
            } else {
               isReady = true;
            }
         } else  {
            xSettingGtk = ["unity-gtk-module"];
            this._setXSettingGtkModules(xSettingGtk);
         }
      } else {
         if(envGtk) {
            let pos = envGtk.indexOf("unity-gtk-module")
            if(pos != -1) {
               envGtk.splice(pos, -1);
               this._setEnvGtkModules(envGtk);
            } else {
               isReady = true;
            }
         } else if(xSettingGtk) {
            let pos = xSettingGtk.indexOf("unity-gtk-module")
            if(pos != -1) {
               xSettingGtk.splice(pos, -1);
               this._setXSettingGtkModules(xSettingGtk);
            } else {
               isReady = true;
            }
         } else  {
            isReady = true;
         }
      }
      return isReady;
   },

   activeQtPlatform: function(active) {
      let envMenuProxy = GLib.getenv('QT_QPA_PLATFORMTHEME');
      if(active && (!envMenuProxy || (envMenuProxy.indexOf("appmenu") == -1))) {
         GLib.setenv('QT_QPA_PLATFORMTHEME', "appmenu-qt5", true);
         return false;
      } else if(active && envMenuProxy && (envMenuProxy.indexOf("appmenu") != -1)) {
         GLib.setenv('QT_QPA_PLATFORMTHEME', "qgnomeplatform", true);
      }
      return true;
   },

   activeUnityMenuProxy: function(active) {
      let envMenuProxy = GLib.getenv('UBUNTU_MENUPROXY');
      if(active && (envMenuProxy != "1")) {
         GLib.setenv('UBUNTU_MENUPROXY', "1", true);
         return false;
      } else if(!active && envMenuProxy == "1") {
         GLib.setenv('UBUNTU_MENUPROXY', "0", true);
      }
      return true;
   },

   setEnvironmentVar: function(show, callback) {
      this._environmentCallback = callback;
      if(show && !this.isEnvironmentSet()) {
          let destFile = Gio.file_new_for_path(FILE_PATH).get_child('utils').get_child('environment.js');
          this._changeModeGFile(destFile, 755);
          Util.spawn([destFile.get_path(), '-i'], Lang.bind(this, this._onEnvironmentChanged));
      } else if(!show && this.isEnvironmentSet()) {
          let destFile = Gio.file_new_for_path(FILE_PATH).get_child('utils').get_child('environment.js');
          this._changeModeGFile(destFile, 755);
          Util.spawn([destFile.get_path(), '-u'], Lang.bind(this, this._onEnvironmentChanged));
      }
   },

   isEnvironmentSet: function() {
      let path = "/etc/profile.d/proxy-globalmenu.sh";
      let file = Gio.file_new_for_path(path);
      return file.query_exists(null);
   },

   _onEnvironmentChanged: function(result) {
      let out = result.split(/\n/);
      if((out.length == 2) && ((out[out.length-2] == "true") || (out[out.length-2] == "false"))) {
         if(this._environmentCallback) {
             this._environmentCallback(this.isEnvironmentSet(), out[out.length-2] == "false");
         }
      } else {
         if(this._environmentCallback) {
             this._environmentCallback(this.isEnvironmentSet(), true);
         }
      }
   },

   _changeModeGFile: function(file, octal) {
      if(file.query_exists(null)) {
         let info = file.query_info("unix::mode", Gio.FileQueryInfoFlags.NONE, null);
         info.set_attribute_uint32("unix::mode", parseInt(octal, 8));
         file.set_attributes_from_info(info, Gio.FileQueryInfoFlags.NONE, null);
      }
   },

   _overrideBoolXSetting: function(xsetting, show) {
      let values = this.xSetting.get_value('overrides').deep_unpack();
      if(show) {
         if(xsetting in values) {
            let status = values[xsetting]
            if(status != 1) {
               values[xsetting] = GLib.Variant.new('i', 1);
               let returnValue = GLib.Variant.new('a{sv}', values);
               this.xSetting.set_value('overrides', returnValue);
            }
         } else {
            values[xsetting] = GLib.Variant.new('i', 1);
            let returnValue = GLib.Variant.new('a{sv}', values);
            this.xSetting.set_value('overrides', returnValue);
         }
      } else if(xsetting in values) {
         let status = values[xsetting]
         if(status != 0) {
            values[xsetting] = GLib.Variant.new('i', 0); 
            let returnValue = GLib.Variant.new('a{sv}', values);
            this.xSetting.set_value('overrides', returnValue);
         }
      }
   },

   _getEnvJavaToolOptions: function() {
      let result = [];
      let env = GLib.getenv('JAVA_TOOL_OPTIONS');
      if(env && env != "") {
         let arrayOptions = env.split(" ");
         for(let pos in arrayOptions) {
            let option = arrayOptions[pos];
            if(option && option != "") {
                result.push(option);
            }
         }
      }
      return result;
   },

   _getEnvGtkModules: function() {
      let envGtk = GLib.getenv('GTK_MODULES');
      if(envGtk)
         return envGtk.split(":");
      return null;
   },

   _setEnvGtkModules: function(envGtkList) {
      let envGtk = "";
      for(let i in envGtkList) {
         if(i == 0) {
            envGtk += envGtkList[i];
         } else if(envGtk.indexOf("unity-gtk-module" ) == -1) {
            envGtk += ":" + envGtkList[i];
         }
      }
      GLib.setenv('GTK_MODULES', envGtk, true);
   },

   _getXSettingGtkModules: function() {
      return this.xSetting.get_strv('enabled-gtk-modules');
   },

   _setXSettingGtkModules: function(envGtkList) {
      this.xSetting.set_strv('enabled-gtk-modules', envGtkList);
   },

   _readFile: function(path) {
      try {
         let file = Gio.file_new_for_path(path);
         if(file.query_exists(null)) {
            let fstream = file.read(null);
            let dstream = new Gio.DataInputStream({ base_stream: fstream });
            let data = dstream.read_until("", null);
            fstream.close(null);
            return data.toString();
         }
      } catch(e) {
         global.logError("Error:" + e.message);
      }
      return null;
   }
};

/*
 * The IndicatorAppMenuWatcher class implements the IndicatorAppMenu dbus object
 */
function IndicatorAppMenuWatcher() {
   this._init.apply(this, arguments);
}

IndicatorAppMenuWatcher.prototype = {

   _init: function(mode, iconSize) {
      this._mode = mode;
      this._iconSize = iconSize;

      this._registeredWindows = { };
      this._everAcquiredName = false;
      this._ownName = null;

      this._xidLast = 0;
      this._windowsChangedId = 0;
      this._notifyWorkspacesId = 0;
      this._focusWindowId = 0;
      this._buggyClientId = 0;

      this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(DBusRegistrar, this);
      this._tracker = Shell.WindowTracker.get_default();
   },

   // DBus Functions
   RegisterWindowAsync: function(params, invocation) {
      let wind = null;
      let [xid, menubarObjectPath] = params;
      // Return a value Firefox and Thunderbird are waiting for it.
      invocation.return_value(new GLib.Variant('()', []));  
      this._registerWindowXId(xid, wind, menubarObjectPath, invocation.get_sender());
      this._emitWindowRegistered(xid, invocation.get_sender(), menubarObjectPath);
   },

   UnregisterWindowAsync: function(params, invocation) {
      let [xid] = params;
      this._destroyMenu(xid);
      if((xid) && (xid in this._registeredWindows))
          this._emitWindowUnregistered(xid);
   },

   GetMenuForWindowAsync: function(params, invocation) {
      let [xid] = params;
      let retval;
      if(xid in this._registeredWindows)
         retval = GLib.Variant.new('(so)', [this._registeredWindows[xid].sender, this._registeredWindows[xid].menubarObjectPath]);
      else
         retval = [];
      invocation.return_value(retval);
   },

   GetMenusAsync: function(params, invocation) {
      let result = [];
      for(let xid in this._registeredWindows) {
         result.push([xid, this._registeredWindows[xid].sender, this._registeredWindows[xid].menubarObjectPath]);
      }
      let retval = GLib.Variant.new('(a(uso))', result);
      invocation.return_value(retval);
   },

   // DBus Signals
   _emitWindowRegistered: function(xid, service, menubarObjectPath) {
      this._dbusImpl.emit_signal('WindowRegistered', GLib.Variant.new('(uso)', [xid, service, menubarObjectPath]));
      global.log("%s RegisterWindow %d %s %s".format(LOG_NAME, xid, service, menubarObjectPath));
   },

   _emitWindowUnregistered: function(xid) {
      this._dbusImpl.emit_signal('WindowUnregistered', GLib.Variant.new('(u)', [xid]));
      global.log("%s UnregisterWindow %d".format(LOG_NAME, xid));
   },

   // Public functions
   watch: function() {
      if(!this._ownName) {
         this._dbusImpl.export(Gio.DBus.session, WATCHER_OBJECT);
         this._ownName = Gio.DBus.session.own_name(WATCHER_INTERFACE,
                               Gio.BusNameOwnerFlags.NONE,
                               Lang.bind(this, this._acquiredName),
                               Lang.bind(this, this._lostName));

         this._registerAllWindows();
         this._onWindowChanged();

         if(this._windowsChangedId == 0) {
            this._windowsChangedId = this._tracker.connect('tracked-windows-changed',
                                     Lang.bind(this, this._updateWindowsList));
         }
         if(this._notifyWorkspacesId == 0) {
            this._notifyWorkspacesId = global.screen.connect('notify::n-workspaces',
                                       Lang.bind(this, this._registerAllWindows));
         }
         if(this._focusWindowId == 0) {
            this._focusWindowId = global.screen.get_display().connect('notify::focus-window',
                                  Lang.bind(this, this._onWindowChanged));
         }
      }
   },

   isWatching: function() {
      return (this._ownName != null);
   },

   getMenuForWindow: function(wind) {
      let xid = this._guessWindowXId(wind);
      if((xid) && (xid in this._registeredWindows)) {
         let appmenu = this._registeredWindows[xid].appMenu;
         if(appmenu)
            return appmenu.getRoot();
      }
      return null;
   },

   updateMenuForWindow: function(wind) {
      let xid = this._guessWindowXId(wind);
      if((xid) && (xid in this._registeredWindows)) {
         let appmenu = this._registeredWindows[xid].appMenu;
         if(appmenu) {
            if(appmenu.isbuggyClient())
               appmenu.fakeSendAboutToShow(appmenu.getRootId());
            else
               appmenu.sendEvent(appmenu.getRootId(), "opened", null, 0);
         }
      }
   },

   getAppForWindow: function(wind) {
      let xid = this._guessWindowXId(wind);
      if((xid) && (xid in this._registeredWindows))
         return this._registeredWindows[xid].application;
      return null;
   },

   getIconForWindow: function(wind) {
      let xid = this._guessWindowXId(wind);
      if((xid) && (xid in this._registeredWindows))
         return this._registeredWindows[xid].icon;
      return null;
   },

   setIconSize: function(iconSize) {
      if(this._iconSize != iconSize) {
         this._iconSize = iconSize;
         for(let xid in this._registeredWindows) {
            this._updateIcon(xid);
         }
         if(this._xidLast) {
            this.emit('appmenu-changed', this._registeredWindows[this._xidLast].window);
         }
      }
   },

   // Private functions
   _acquiredName: function() {
      this._everAcquiredName = true;
      global.log("%s Acquired name %s".format(LOG_NAME, WATCHER_INTERFACE));
   },

   _lostName: function() {
      this._everAcquiredName = false;
      if(this._everAcquiredName)
         global.log("%s Lost name %s".format(LOG_NAME, WATCHER_INTERFACE));
      else
         global.logWarning("%s Failed to acquire %s".format(LOG_NAME, WATCHER_INTERFACE));
      this._ownName = null;
   },

   // Async because we may need to check the presence of a menubar object as well as the creation is async.
   _getMenuClient: function(xid, callback) {
      if(xid in this._registeredWindows) {
         var sender = this._registeredWindows[xid].sender;
         var menubarPath = this._registeredWindows[xid].menubarObjectPath;
         var windowPath = this._registeredWindows[xid].windowObjectPath;
         var appPath = this._registeredWindows[xid].appObjectPath;
         var is_gtk = this._registeredWindows[xid].isGtk;
         var wind = this._registeredWindows[xid].window;
         if((sender)&&(menubarPath)&&(!wind || (wind.get_window_type() != Meta.WindowType.DESKTOP))) {
            if(!is_gtk) {
               this._validateMenu(sender, menubarPath, Lang.bind(this, function(r, name, menubarPath) {
                  if(r) {
                     if(!this._registeredWindows[xid].appMenu) {
                        global.log("%s Creating menu on %s, %s".format(LOG_NAME, sender, menubarPath));
                        callback(xid, new DBusMenu.DBusClient(name, menubarPath));
                     } else {
                        callback(xid, null);
                     }
                  } else {
                     callback(xid, null);
                  }
               }));
            } else {
               if(!this._registeredWindows[xid].appMenu) {
                  global.log("%s Creating menu on %s, %s".format(LOG_NAME, sender, menubarPath));
                  callback(xid, new DBusMenu.DBusClientGtk(sender, menubarPath, windowPath, appPath));
               } else {
                  callback(xid, null);
               }
            }
         } else {
            callback(xid, null);
         }
      } else {
         callback(xid, null);
      }
   },

   _onMenuClientReady: function(xid, client) {
      if(this._registeredWindows && (client != null)) {
         this._registeredWindows[xid].appMenu = client;
         let root = client.getRoot();
         root.connectAndRemoveOnDestroy({
            'childs-empty'   : Lang.bind(this, this._onMenuEmpty, xid),
            'destroy'        : Lang.bind(this, this._onMenuDestroy, xid)
         });
         if(this._guessWindowXId(global.display.focus_window) == xid) {
            this._onWindowChanged();
         } else if(!this._registeredWindows[xid].window) {
            this._registerAllWindows();
         }
      }
   },

   _onMenuEmpty: function(root, xid) {
      // We don't have alternatives now, so destroy the appmenu.
      this._onMenuDestroy(root, xid);
   },

   _onMenuDestroy: function(root, xid) {
      this._destroyMenu(xid);
   },

   _destroyMenu: function(xid) {
      if((xid) && (xid in this._registeredWindows)) {
         let appMenu = this._registeredWindows[xid].appMenu;
         this._registeredWindows[xid].appMenu = null;
         if(appMenu) {
            appMenu.destroy();
         }
         if(this.isWatching() && (this._xidLast == xid) && (xid == this._guessWindowXId(global.display.focus_window))) {
            this.emit('appmenu-changed', this._registeredWindows[xid].window);
         }
      }
   },

   _validateMenu: function(bus, path, callback) {
      Gio.DBus.session.call(
         bus, path, "org.freedesktop.DBus.Properties", "Get",
         GLib.Variant.new("(ss)", ["com.canonical.dbusmenu", "Version"]),
         GLib.VariantType.new("(v)"), Gio.DBusCallFlags.NONE, -1, null, function(conn, result) {
            try {
               var val = conn.call_finish(result);
            } catch (e) {
               global.logWarning(LOG_NAME + "Invalid menu. " + e);
               return callback(false);
            }
            var version = val.deep_unpack()[0].deep_unpack();
            // FIXME: what do we implement?
            if(version >= 2) {
               return callback(true, bus, path);
            } else {
               global.logWarning("%s Incompatible dbusmenu version %s".format(LOG_NAME, version));
               return callback(false);
            }
         }, null
      );
   },

   _registerAllWindows: function () {
      for(let index = 0; index < global.screen.n_workspaces; index++) {
         let metaWorkspace = global.screen.get_workspace_by_index(index);
         let winList = metaWorkspace.list_windows();
         // For each window, let's make sure we add it!
         for(let pos in winList) {
            let wind = winList[pos];
            if(Main.isInteresting(wind)) {
               let xid = this._guessWindowXId(wind);
               if((xid) && !((xid in this._registeredWindows)&&(this._registeredWindows[xid].fail))) {
                  this._registerWindowXId(xid, wind);
               }
            }
         }
      }
   },

   _updateWindowsList: function () {
      let current = new Array();
      for(let index = 0; index < global.screen.n_workspaces; index++) {
         let metaWorkspace = global.screen.get_workspace_by_index(index);
         let winList = metaWorkspace.list_windows();
         // For each window, let's make sure we add it!
         for(let pos in winList) {
            let wind = winList[pos];
            if(Main.isInteresting(wind)) {
               let xid = this._guessWindowXId(wind);
               if(xid)
                  current.push(xid.toString());
            }
         }
      }
      for(let xid in this._registeredWindows) {
         if(current.indexOf(xid) == -1) {
            this._destroyMenu(xid);
            this._emitWindowUnregistered(xid);
            //FIXME Clementine can register the menu without have a windows yet (Maybe others?)
            // So please, remember the Dbus Menu configuration(don't delete record).
            //delete this._registeredWindows[xid];
         }
      }
      GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, Lang.bind(this, function() {
         if(this._buggyClientId != 0) {
            GLib.source_remove(this._buggyClientId);
            this._buggyClientId = 0;
         }
         this._verifyBuggyClient(0);
      }));
   },

   _verifyBuggyClient: function(time) {
      if(time < 60000) {
         this._buggyClientId = GLib.timeout_add(GLib.PRIORITY_DEFAULT_IDLE, 500, Lang.bind(this, function() {
            this._onWindowChanged();
            this._verifyBuggyClient(time + 500);
         }));
      }
   },

   _updateIcon: function(xid) {
      if(xid in this._registeredWindows) {
         if(this._registeredWindows[xid].icon) {
            this._registeredWindows[xid].icon.destroy();
            this._registeredWindows[xid].icon = null;
         }
         let app = this._registeredWindows[xid].application;
         if(app) {
            let icon = app.create_icon_texture(this._iconSize);
            this._registeredWindows[xid].icon = icon;
         }
      }
   },

   _registerWindowXId: function(xid, wind, menubarPath, senderDbus) {
      let appTracker = null, appmenuPath = null, windowPath = null, appPath = null;
      let isGtkApp = false;

      if(wind) {
         appTracker = this._tracker.get_window_app(wind);
         if((!menubarPath)||(!senderDbus)) {
            if((appTracker)&&(GTK_BLACKLIST.indexOf(appTracker.get_id()) == -1)) {
               menubarPath = wind.get_gtk_menubar_object_path();
               appmenuPath = wind.get_gtk_app_menu_object_path();
               windowPath  = wind.get_gtk_window_object_path();
               appPath     = wind.get_gtk_application_object_path();
               senderDbus  = wind.get_gtk_unique_bus_name();
               isGtkApp    = (senderDbus != null);
            }
         }
      }

      let dbusPropertiesChanged = false;
      if(xid in this._registeredWindows) {
         // Firefox use the regitrar iface and also the gtk way, but it unsupported.
         // We ask then for the new data and prevent the override of registrar.
         if(menubarPath && menubarPath != this._registeredWindows[xid].menubarObjectPath) {
            this._registeredWindows[xid].menubarObjectPath = menubarPath;
            dbusPropertiesChanged = true;
         }
         if(appmenuPath && appmenuPath != this._registeredWindows[xid].appmenuObjectPath) {
            this._registeredWindows[xid].appmenuObjectPath = appmenuPath;
            dbusPropertiesChanged = true;
         }
         if(windowPath && windowPath != this._registeredWindows[xid].windowObjectPath) {
            this._registeredWindows[xid].windowObjectPath = windowPath;
            dbusPropertiesChanged = true;
         }
         if(appPath && appPath != this._registeredWindows[xid].appObjectPath) {
            this._registeredWindows[xid].appObjectPath = appPath;
            dbusPropertiesChanged = true;
         }
         if(senderDbus && senderDbus != this._registeredWindows[xid].sender) {
            this._registeredWindows[xid].sender = senderDbus;
            dbusPropertiesChanged = true;
         }
         if(appTracker && appTracker != this._registeredWindows[xid].application) {
            this._registeredWindows[xid].application = appTracker;
            //dbusPropertiesChanged = true;
         }
         if(wind && wind != this._registeredWindows[xid].window) {
            this._registeredWindows[xid].window = wind;
            //dbusPropertiesChanged = true;
         }
         if(dbusPropertiesChanged && this._registeredWindows[xid].appMenu) {
            //Main.notify("es " + xid + " " + senderDbus + " " + menubarPath);
            this._destroyMenu(xid);
            this._registeredWindows[xid].fail = false;
         }
      } else {
         this._registeredWindows[xid] = {
            window: wind,
            application: appTracker,
            menubarObjectPath: menubarPath,
            appmenuObjectPath: appmenuPath,
            windowObjectPath: windowPath,
            appObjectPath: appPath,
            sender: senderDbus,
            isGtk: isGtkApp,
            icon: null,
            appMenu: null,
            fail: false
         };
      }
      this._tryToGetMenuClient(xid);
   },

   _tryToGetMenuClient: function(xid) {
      if((xid in this._registeredWindows) && (!this._registeredWindows[xid].appMenu)) {
         if((this._registeredWindows[xid].menubarObjectPath) &&
            (this._registeredWindows[xid].sender)) {
            // FIXME JAyantana is slow, we need to wait for it a little.
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, Lang.bind(this, function() {
               this._getMenuClient(xid, Lang.bind(this, this._onMenuClientReady));
            }));
         } else {
            this._registeredWindows[xid].fail = true;
         }
      }  
   },

   _onWindowChanged: function() {
      let xid = this._guessWindowXId(global.display.focus_window);
      if(xid && this._registeredWindows) {
         if(global.display.focus_window.get_window_type() != Meta.WindowType.DESKTOP) {
            if(global.display.focus_window.set_hide_titlebar_when_maximized)
               global.display.focus_window.set_hide_titlebar_when_maximized(true);
            let registerWin = null;
            if(xid in this._registeredWindows) {
               registerWin = this._registeredWindows[xid];
               if((!registerWin.fail) && 
                  ((!registerWin.appMenu)||(!registerWin.window))) {
                  this._registerAllWindows();
                  registerWin = this._registeredWindows[xid];
               }
            } else {
               this._registerAllWindows();
               if(xid in this._registeredWindows)
                  registerWin = this._registeredWindows[xid];
            }
            this._updateIcon(xid);
            if(registerWin) {
               this.emit('appmenu-changed', registerWin.window);
               this._xidLast = xid;
            }
         } else {
            this.emit('appmenu-changed', null);
            this._xidLast = null;
         }
      } else {
         //this.emit('appmenu-changed', null);
         this._xidLast = null;
      }
   },

   // NOTE: we prefer to use the window's XID but this is not stored
   // anywhere but in the window's description being [XID (%10s window title)].
   // And I'm not sure I want to rely on that being the case always.
   // (mutter/src/core/window-props.c)
   //
   // If we use the windows' title, `xprop` grabs the "least-focussed" window
   // (bottom of stack I suppose).
   //
   // Can match winow.get_startup_id() to WM_WINDOW_ROLE(STRING)
   // If they're not equal, then try the XID?
   _guessWindowXId: function (wind) {
      if(!wind)
         return null;

      let id = null;
      // If window title has non-utf8 characters, get_description() complains
      // "Failed to convert UTF-8 string to JS string: Invalid byte sequence in conversion input",
      // event though get_title() works.
      if(wind.get_xwindow)
         return wind.get_xwindow();
      try {
         id = wind.get_description().match(/0x[0-9a-f]+/);
         if(id) {
            return parseInt(id[0], 16);
         }
      } catch(err) {
      }

      // Use xwininfo, take first child.
      let act = wind.get_compositor_private();
      if(act && act['x-window']) {
         id = GLib.spawn_command_line_sync('xwininfo -children -id 0x%x'.format(act['x-window']));
         if(id[0]) {
            let str = id[1].toString();

            // The X ID of the window is the one preceding the target window's title.
            // This is to handle cases where the window has no frame and so
            // act['x-window'] is actually the X ID we want, not the child.
            let regexp = new RegExp('(0x[0-9a-f]+) +"%s"'.format(wind.title));
            id = str.match(regexp);
            if(id) {
               return parseInt(id[1], 16);
            }

            // Otherwise, just grab the child and hope for the best
            id = str.split(/child(?:ren)?:/)[1].match(/0x[0-9a-f]+/);
            if(id) {
               return parseInt(id[0], 16);
            }
         }
      }
      // Debugging for when people find bugs..
      global.logError("%s Could not find XID for window with title %s".format(LOG_NAME, wind.title));
      return null;
   },

   destroy: function() {
      if(this._registeredWindows) {
         // This doesn't do any sync operation and doesn't allow us to hook up the event of being finished
         // which results in our unholy debounce hack (see extension.js)
         Gio.DBus.session.unown_name(this._ownName);
         this._dbusImpl.unexport();
         this._everAcquiredName = false;
         this._ownName = null;
         if(this._focusWindowId > 0) {
            global.screen.get_display().disconnect(this._focusWindowId);
            this._focusWindowId = 0;
         }
         if(this._notifyWorkspacesId > 0) {
            global.screen.disconnect(this._notifyWorkspacesId);
            this._notifyWorkspacesId = 0;
         }
         if(this._windowsChangedId > 0) {
            this._tracker.disconnect(this._windowsChangedId);
            this._windowsChangedId = 0;
         }
         for(let xid in this._registeredWindows) {
            let register = this._registeredWindows[xid];
            if(register.icon)
               register.icon.destroy();
            this._destroyMenu(xid);
            this._emitWindowUnregistered(xid);
         }
         this._registeredWindows = null;
      }
   }
};
Signals.addSignalMethods(IndicatorAppMenuWatcher.prototype);
