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
const Gtk = imports.gi.Gtk;

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
      this._gtkSettings = Gtk.Settings.get_default();
   },

   shellShowAppmenu: function(show) {
      this._overrideBoolXSetting('Gtk/ShellShowsAppMenu', show);
      this._gtkSettings.gtk_shell_shows_app_menu = show;
   },

   shellShowMenubar: function(show) {
      this._overrideBoolXSetting('Gtk/ShellShowsMenubar', show);
      this._gtkSettings.gtk_shell_shows_menubar = show;
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
         if(!this._gtkSettings.gtk_modules) {
             this._gtkSettings.gtk_modules = "unity-gtk-module";
         } else if(this._gtkSettings.gtk_modules.indexOf("unity-gtk-module") == -1) {
            Gtk.Settings.gtk_modules += ":unity-gtk-module";
         }
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
         if(this._gtkSettings.gtk_modules) {
            let index = this._gtkSettings.gtk_modules.indexOf("unity-gtk-module");
            let len = this._gtkSettings.gtk_modules.length;
            if(index != -1) {
               let newModules = null;
               if(len > 16) {
                  newModules = this._gtkSettings.gtk_modules.substring(0, index - 2) +
                               this._gtkSettings.gtk_modules.substring(index + 16, this._gtkSettings.gtk_modules.length);
               }
               Gtk.Settings.gtk_modules = newModules;
            } 
         }
         if(envGtk) {
            let pos = envGtk.indexOf("unity-gtk-module");
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
 * The X11RegisterMenuWatcher class implements
 * the cannonical registrar dbus Interface.
 * Here will need to encapsulate things to
 * handled the windows xid mechanims.
 */
function X11RegisterMenuWatcher() {
   this._init.apply(this, arguments);
}

X11RegisterMenuWatcher.prototype = {
   _init: function() {
      this._registeredWindows = { };
      this._everAcquiredName = false;
      this._ownName = null;
      this._windowsCreatedId = 0;
      this._windowsChangedId = 0;
      this._tracker = Shell.WindowTracker.get_default();
      this._dbusImpl = Gio.DBusExportedObject.wrapJSObject(DBusRegistrar, this);
   },

   // Private functions
   _acquiredName: function() {
      this._everAcquiredName = true;
      global.log("X11Menu Whatcher: Acquired name %s".format(WATCHER_INTERFACE));
   },

   _lostName: function() {
      this._everAcquiredName = false;
      if(this._everAcquiredName)
         global.log("X11Menu Whatcher: Lost name %s".format(WATCHER_INTERFACE));
      else
         global.logWarning("X11Menu Whatcher: Failed to acquire %s".format(WATCHER_INTERFACE));
      this._ownName = null;
   },

   watch: function() {
      if(!this._ownName) {
         this._dbusImpl.export(Gio.DBus.session, WATCHER_OBJECT);
         this._ownName = Gio.DBus.session.own_name(
            WATCHER_INTERFACE,
            Gio.BusNameOwnerFlags.NONE,
            Lang.bind(this, this._acquiredName),
            Lang.bind(this, this._lostName)
         );
         this._updateWindowList();
         if(this._windowsCreatedId == 0) {
            this._windowsCreatedId = global.display.connect('window-created', Lang.bind(this, this._updateWindowList));
         }
         if(this._windowsChangedId == 0) {
            this._windowsChangedId = this._tracker.connect('tracked-windows-changed', Lang.bind(this, this._updateWindowList));
         }
      }
   },

   isWatching: function() {
      return (this._ownName != null);
   },

   getMenuForWindow: function(window) {
      let xid = this._guessWindowXId(window);
      if(xid && (xid in this._registeredWindows)) {
         return this._registeredWindows[xid].appMenu;
      }
      return null;
   },

   updateMenuForWindow: function(window) {
      let xid = this._guessWindowXId(window);
      if(xid && (xid in this._registeredWindows)) {
         let appmenu = this._registeredWindows[xid].appMenu;
         if(appmenu) {
            if(appmenu.isbuggyClient())
               appmenu.fakeSendAboutToShow(appmenu.getRootId());
            else
               appmenu.sendEvent(appmenu.getRootId(), "opened", null, 0);
            return true;
         }
      }
      return false;
   },

   // DBus Functions
   RegisterWindowAsync: function(params, invocation) {
      let wind = null;
      let [xid, menubarObjectPath] = params;
      let sender = invocation.get_sender();
      this._registerWindowXId(xid, menubarObjectPath, sender);
      this._dbusImpl.emit_signal('WindowRegistered', GLib.Variant.new('(uso)', [xid, sender, menubarObjectPath]));
      global.log("X11Menu Whatcher: RegisterWindow %d %s %s".format(xid, sender, menubarObjectPath));
      // Return a value Firefox and Thunderbird are waiting for it.
      invocation.return_value(new GLib.Variant('()', []));  
   },

   UnregisterWindowAsync: function(params, invocation) {
      let [xid] = params;
      this._destroyMenu(xid);
      this._emitWindowUnregistered(xid);
   },

   _emitWindowUnregistered: function(xid) {
      if((xid) && (xid in this._registeredWindows) && this.isWatching()) {
          this._dbusImpl.emit_signal('WindowUnregistered', GLib.Variant.new('(u)', [xid]));
          global.log("X11Menu Whatcher: UnregisterWindow %d".format(xid));
      }
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

   _updateWindowList: function() {
      let current = global.get_window_actors();
      let metaWindows = new Array();
      for (let pos in current) {
          let xid = this._guessWindowXId(current[pos].meta_window);
          if(xid) {
             metaWindows.push(xid);
          }
      }
      for (let xid in this._registeredWindows) {
         if(metaWindows.indexOf(xid) == -1) {
            this._unregisterWindows(xid);
         }
      }
   },

   _unregisterWindows: function(xid) {
      if(xid in this._registeredWindows) {
         //this._emitWindowUnregistered(xid);
         //this._destroyMenu(xid);
         //delete this._registeredWindows[xid];
         if(this.isWatching()) {
            this.emit('client-menu-changed', null);
         }
      }
   },

   _onMenuClientReady: function(xid, client) {
      if((xid in this._registeredWindows) && (client != null)) {
         this._registeredWindows[xid].appMenu = client;
         let root = client.getRoot();
         root.connectAndRemoveOnDestroy({
            'childs-empty'   : Lang.bind(this, this._onMenuEmpty, xid),
            'destroy'        : Lang.bind(this, this._onMenuDestroy, xid)
         });
         if(this.isWatching()) {
            this.emit('client-menu-changed', this._registeredWindows[xid].appMenu);
         }
      }
   },

   _onMenuEmpty: function(root, xid) {
      // We don't have alternatives now, so destroy the appmenu?
      // this._onMenuDestroy(root, xid);
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
         if(this.isWatching()) {
            this.emit('client-menu-changed', null);
         }
      }
   },

   // Async because we may need to check the presence of a menubar object as well as the creation is async.
   _getMenuClient: function(xid, callback) {
      if(xid in this._registeredWindows) {
         var sender = this._registeredWindows[xid].sender;
         var menubarPath = this._registeredWindows[xid].menubarObjectPath;
         if(sender && menubarPath) {
            this._validateMenu(sender, menubarPath, Lang.bind(this, function(result, name, menubarPath) {
               if(result) {
                  if(!this._registeredWindows[xid].appMenu) {
                     global.log("X11Menu Whatcher: Creating menu on %s, %s".format(sender, menubarPath));
                     callback(xid, new DBusMenu.DBusClient(name, menubarPath));
                  } else {
                     callback(xid, null);
                  }
               } else {
                  callback(xid, null);
               }
            }));
         } else {
            callback(xid, null);
         }
      } else {
         callback(xid, null);
      }
   },

   _tryToGetMenuClient: function(xid) {
      if((xid in this._registeredWindows) && (!this._registeredWindows[xid].appMenu)) {
         if((this._registeredWindows[xid].menubarObjectPath) &&
            (this._registeredWindows[xid].sender)) {
            // FIXME JAyantana is slow, we need to wait for it a little.
            //GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, Lang.bind(this, function() {
               this._getMenuClient(xid, Lang.bind(this, this._onMenuClientReady));
            //}));
         } else {
            this._registeredWindows[xid].fail = true;
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
               global.logWarning("X11Menu Whatcher: Invalid menu. %s".format(e));
               return callback(false);
            }
            var version = val.deep_unpack()[0].deep_unpack();
            // FIXME: what do we implement?
            if(version >= 2) {
               return callback(true, bus, path);
            } else {
               global.logWarning("X11Menu Whatcher: Incompatible dbusmenu version %s".format(version));
               return callback(false);
            }
         }, null
      );
   },

   _registerWindowXId: function(xid, menubarPath, senderDbus) {
      if(!(xid in this._registeredWindows)) {
         this._registeredWindows[xid] = {
            menubarObjectPath: menubarPath,
            sender: senderDbus,
            appMenu: null,
            fail: false
         };
         this._tryToGetMenuClient(xid);
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
      if(wind.get_xwindow)
         return wind.get_xwindow().toString();
      // If window title has non-utf8 characters, get_description() complains
      // "Failed to convert UTF-8 string to JS string: Invalid byte sequence in conversion input",
      // event though get_title() works.
      let id = null;
      try {
         id = wind.get_description().match(/0x[0-9a-f]+/);
         if(id) {
            return parseInt(id[0], 16).toString();
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
               return parseInt(id[1], 16).toString();
            }

            // Otherwise, just grab the child and hope for the best
            id = str.split(/child(?:ren)?:/)[1].match(/0x[0-9a-f]+/);
            if(id) {
               return parseInt(id[0], 16).toString();
            }
         }
      }
      // Debugging for when people find bugs..
      global.logError("X11Menu Whatcher: Could not find XID for window with title %s".format(wind.title));
      return null;
   },

   destroy: function() {
      if(this._registeredWindows) {
         // This doesn't do any sync operation and doesn't allow us to hook up the event of being finished
         // which results in our unholy debounce hack (see extension.js)
         if(this._windowsCreatedId > 0) {
            global.display.disconnect(this._windowsCreatedId);
            this._windowsCreatedId = 0;
         }
         if(this._windowsChangedId > 0) {
            this._tracker.disconnect(this._windowsChangedId);
            this._windowsChangedId = 0;
         }
         for(let xid in this._registeredWindows) {
            let register = this._registeredWindows[xid];
            this._destroyMenu(xid);
            this._emitWindowUnregistered(xid);
         }
         this._registeredWindows = null;
         if(this._ownName) {
            Gio.DBus.session.unown_name(this._ownName);
            this._dbusImpl.unexport();
            this._everAcquiredName = false;
            this._ownName = null;
         }
      }
   }
};
Signals.addSignalMethods(X11RegisterMenuWatcher.prototype);

function GtkMenuWatcher() {
   this._init.apply(this, arguments);
}

GtkMenuWatcher.prototype = {
   _init: function() {
      this._registeredWindows = [];
      this._isWatching = false;
      this._windowsCreatedId = 0;
      this._windowsChangedId = 0;
      this._tracker = Shell.WindowTracker.get_default();
   },

   // Public functions
   watch: function() {
      if(!this.isWatching()) {
         this._updateWindowList();
         if(this._windowsCreatedId == 0) {
            this._windowsCreatedId = global.display.connect('window-created', Lang.bind(this, this._updateWindowList));
         }
         if(this._windowsChangedId == 0) {
            this._windowsChangedId = this._tracker.connect('tracked-windows-changed', Lang.bind(this, this._updateWindowList));
         }
         this._isWatching = true;
      }
   },

   getMenuForWindow: function(window) {
      let index = this._findWindow(window);
      if(index != -1) {
         return this._registeredWindows[index].appMenu;
      }
      return null;
   },

   updateMenuForWindow: function(window) {
      let index = this._findWindow(window);
      if(index != -1) {
         let appmenu = this._registeredWindows[index].appMenu;
         if(appmenu) {
            if(appmenu.isbuggyClient())
               appmenu.fakeSendAboutToShow(appmenu.getRootId());
            else
               appmenu.sendEvent(appmenu.getRootId(), "opened", null, 0);
         }
      }
   },

   isWatching: function() {
      return this._isWatching;
   },

   _findWindow: function(window) {
      for (let i = 0; i < this._registeredWindows.length; i++) {
         if (window == this._registeredWindows[i].window)
            return i;
      }
      return -1;
   },

   _validateMenu: function(bus, path, callback) {
      Gio.DBus.session.call(
         bus, path, "org.freedesktop.DBus.Properties", "Get",
         GLib.Variant.new("(ss)", ["com.canonical.dbusmenu", "Version"]),
         GLib.VariantType.new("(v)"), Gio.DBusCallFlags.NONE, -1, null, function(conn, result) {
            try {
               var val = conn.call_finish(result);
            } catch (e) {
               global.logWarning("GtkMenu Watcher: Invalid menu. %s".format(e));
               return callback(false);
            }
            var version = val.deep_unpack()[0].deep_unpack();
            // FIXME: what do we implement?
            if(version >= 2) {
               return callback(true, bus, path);
            } else {
               global.logWarning("GtkMenu Watcher: Incompatible dbusmenu version %s".format(version));
               return callback(false);
            }
         }, null
      );
   },

   // Async because we may need to check the presence of a menubar object as well as the creation is async.
   _getMenuClient: function(window, callback) {
      let index = this._findWindow(window);
      if(index != -1) {
         var sender = this._registeredWindows[index].sender;
         var menubarPath = this._registeredWindows[index].menubarObjectPath;
         var windowPath = this._registeredWindows[index].windowObjectPath;
         var appPath = this._registeredWindows[index].appObjectPath;
         var isGtk = this._registeredWindows[index].isGtk;
         if(sender && menubarPath && window && (window.get_window_type() != Meta.WindowType.DESKTOP)) {
            if(!isGtk) {
               let appMenu = this._x11Client.getMenuForWindow(window);
               callback(window, appMenu);
            } else {
               if(!this._registeredWindows[index].appMenu) {
                  global.log("GtkMenu Watcher: Creating menu on %s, %s".format(sender, menubarPath));
                  callback(window, new DBusMenu.DBusClientGtk(sender, menubarPath, windowPath, appPath));
               } else {
                  callback(window, null);
               }
            }
         } else {
            callback(window, null);
         }
      } else {
         callback(window, null);
      }
   },

   _onMenuClientReady: function(window, client) {
      let index = this._findWindow(window);
      if(this.isWatching() && (client != null) && (index != -1)) {
         this._registeredWindows[index].appMenu = client;
         let root = client.getRoot();
         root.connectAndRemoveOnDestroy({
            'childs-empty'   : Lang.bind(this, this._onMenuEmpty, window),
            'destroy'        : Lang.bind(this, this._onMenuDestroy, window)
         });
         this.emit('client-menu-changed', this._registeredWindows[index].appMenu);
      }
   },

   _onMenuEmpty: function(root, window) {
      // We don't have alternatives now, so destroy the appmenu.
      // this._onMenuDestroy(root, index);
   },

   _onMenuDestroy: function(root, window) {
      this._destroyMenu(window);
   },

   _destroyMenu: function(window) {
      let index = this._findWindow(window);
      if(index != -1) {
         let appMenu = this._registeredWindows[index].appMenu;
         this._registeredWindows[index].appMenu = null;
         if(appMenu) {
            appMenu.destroy();
         }
         if(this.isWatching()) {
            this.emit('client-menu-changed', null);
         }
      }
   },

   _updateWindowList: function() {
      let current = global.get_window_actors();
      let metaWindows = new Array();
      for (let index in current) {
         try {
            let pr = Object.getOwnPropertyNames(current[index]);
            global.log("yeyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyyy" + pr + "-------");
            for(let key in pr) {
              global.log("" + key + "---->" + pr[key] + ":---:");
            }
         } catch(e) {
            global.log("Errorrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr: " + e);
         }
          this._registerWindow(current[index].meta_window);
          metaWindows.push(current[index].meta_window);
      }
      for (let index in this._registeredWindows) {
         if(metaWindows.indexOf(this._registeredWindows[index].window) == -1) {
            this._unregisterWindows(this._registeredWindows[index].window);
         }
      }
   },

   _unregisterWindows: function(window) {
      let index = this._findWindow(window);
      if(index != -1) {
         this._destroyMenu(window);
         let appMenu = this._registeredWindows[index].appMenu;
         if(appMenu) {
            appMenu.destroy();
         }
         this._registeredWindows.splice(index, 1);
         if(this.isWatching()) {
            this.emit('client-menu-changed', null);
         }
      }
   },

   _registerWindow: function(window) {
      let senderDbus=null, isGtkApp = false;
      let appmenuPath = null, menubarPath=null, windowPath = null, appPath = null;
      let appTracker = this._tracker.get_window_app(window);
      let index = this._findWindow(window);
      if((index == -1) && (appTracker)&&(GTK_BLACKLIST.indexOf(appTracker.get_id()) == -1)) {
         menubarPath = window.get_gtk_menubar_object_path();
         appmenuPath = window.get_gtk_app_menu_object_path();
         windowPath  = window.get_gtk_window_object_path();
         appPath     = window.get_gtk_application_object_path();
         senderDbus  = window.get_gtk_unique_bus_name();
         isGtkApp    = (senderDbus != null);
         global.log("properties 1:" + menubarPath + " --- 2:" + appmenuPath + " --- 3:" + windowPath + " --- 4:" + appPath + " --- 5:" + senderDbus + " --- 6:" + appTracker.get_name());
         try {
            let pr = Object.getOwnPropertyNames(window);
            global.log("passsssssssssssssssssssssssssssssssssssssssssssssssssssssssssssssss" + pr + "-------");
            for(let key in pr) {
              global.log("" + key + "---->" + pr[key] + ":---:");
            }
         } catch(e) {
            global.log("Errorrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr: " + e);
         }
         let windowData = {
            window: window,
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
         this._registeredWindows.push(windowData);
         index = this._registeredWindows.length -1;
         this._tryToGetMenuClient(window);
      }
   },

   _tryToGetMenuClient: function(window) {
      let index = this._findWindow(window);
      if((index != -1) && (!this._registeredWindows[index].appMenu)) {
         if((this._registeredWindows[index].menubarObjectPath) &&
            (this._registeredWindows[index].sender)) {
            // FIXME JAyantana is slow, we need to wait for it a little.
            GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, Lang.bind(this, function() {
               this._getMenuClient(window, Lang.bind(this, this._onMenuClientReady));
            }));
         } else {
            this._registeredWindows[index].fail = true;
         }
      }  
   },

   destroy: function() {
      if(this.isWatching()) {
         // This doesn't do any sync operation and doesn't allow us to hook up the event of being finished
         // which results in our unholy debounce hack (see extension.js)
         this._isWatching = false;
         if(this._windowsCreatedId > 0) {
            global.display.disconnect(this._windowsCreatedId);
            this._windowsCreatedId = 0;
         }
         if(this._windowsChangedId > 0) {
            this._tracker.disconnect(this._windowsChangedId);
            this._windowsChangedId = 0;
         }
         for(let index in this._registeredWindows) {
            this._destroyMenu(this._registeredWindows[index].window);
         }
         this._registeredWindows = null;
      }
   }
};
Signals.addSignalMethods(GtkMenuWatcher.prototype);

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

      this.focusWindow = null;
      this._windowsChangedId = 0;
      this._focusWindowId = 0;
      this._buggyClientId = 0;
      this._tracker = Shell.WindowTracker.get_default();

      this.providers = [
         new X11RegisterMenuWatcher(),
         new GtkMenuWatcher()
      ];
      for(let i = 0; i < this.providers.length; i++) {
         this.providers[i].connect('client-menu-changed', Lang.bind(this, this._onMenuChange));
      }
   },

   _onMenuChange: function(client, menu) {
      if(!this.focusWindow || (menu == client.getMenuForWindow(this.focusWindow))) {
          this.emit('appmenu-changed', this.focusWindow, menu);
      }
   },

   // Public functions
   watch: function() {
      if(!this.isWatching()) {
         for(let i = 0; i < this.providers.length; i++) {
            this.providers[i].watch();
         }
         this._onWindowChanged();
         if(this._focusWindowId == 0) {
            this._focusWindowId = global.screen.get_display().connect('notify::focus-window',
                                  Lang.bind(this, this._onWindowChanged));
         }
      }
   },

   getRootMenuForWindow: function(window) {
      let appmenu = this.getMenuForWindow(window);
      if(appmenu)
         return appmenu.getRoot();
      return null;
   },

   getMenuForWindow: function(window) {
      for(let i = 0; i < this.providers.length; i++) {
         let appmenu = this.providers[i].getMenuForWindow(window);
         if(appmenu)
            return appmenu;
      }
      return null;
   },

   updateMenuForWindow: function(window) {
      for(let i = 0; i < this.providers.length; i++) {
         this.providers[i].updateMenuForWindow(window);
      }
   },

   getAppForWindow: function(window) {
      return this._tracker.get_window_app(window);
   },

   getIconForWindow: function(window) {
      let app = this.getAppForWindow(window);
      if(app) {
         return app.create_icon_texture(this._iconSize);
      }
      return null;
   },

   setIconSize: function(iconSize) {
      this._iconSize = iconSize;
   },

   _onWindowChanged: function() {
      let window = global.display.focus_window;
      if(this.isWatching()) {
         if(window && (window.get_window_type() != Meta.WindowType.DESKTOP)) {
            this.focusWindow = window;
            let menu = this.getMenuForWindow(this.focusWindow);
            this.emit('appmenu-changed', this.focusWindow, menu);
         } else if(!global.stage.key_focus) {
            this.emit('appmenu-changed', null, null);
         }
      }
   },

   isWatching: function() {
      if(this.providers && this.providers.length > 0) {
         for(let i = 0; i < this.providers.length; i++) {
            if(!this.providers[i].isWatching())
               return false;
         }
         return true;
      }
      return false;
   },

   destroy: function() {
      if(this.providers) {
         // This doesn't do any sync operation and doesn't allow us to hook up the event of being finished
         // which results in our unholy debounce hack (see extension.js)
         for(let i = 0; i < this.providers.length; i++) {
            this.providers[i].destroy();
         }
         this.providers = null;
         if(this._focusWindowId > 0) {
            global.screen.get_display().disconnect(this._focusWindowId);
            this._focusWindowId = 0;
         }
         this._registeredWindows = null;
         this.emit('appmenu-changed', null, null);
      }
   }
};
Signals.addSignalMethods(IndicatorAppMenuWatcher.prototype);
