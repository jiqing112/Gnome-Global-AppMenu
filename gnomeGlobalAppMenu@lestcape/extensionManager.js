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

const Clutter = imports.gi.Clutter;
const St = imports.gi.St;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;
const Shell = imports.gi.Shell;
const Lang = imports.lang;
const Gettext = imports.gettext;

const Main = imports.ui.main;
const Panel = imports.ui.panel;
const Util = imports.misc.util;
const ExtensionSystem = imports.ui.extensionSystem;

const MyExtension = imports.misc.extensionUtils.getCurrentExtension();
const Applet = MyExtension.imports.applet;
const ConfigurableMenus = MyExtension.imports.configurableMenus;
const IndicatorAppMenuWatcher = MyExtension.imports.indicatorAppMenuWatcher;
const Settings = MyExtension.imports.settings.settings;
const HudProvider = MyExtension.imports.hudProvider;
const RemoteMenu = MyExtension.imports.remoteMenu;
const HudSearch = MyExtension.imports.hudSearch;


function _(str) {
   let resultConf = Gettext.dgettext(MyExtension.uuid, str);
   if(resultConf != str) {
      return resultConf;
   }
   return Gettext.gettext(str);
};

function MyMenuFactory() {
   this._init.apply(this, arguments);
}

MyMenuFactory.prototype = {
   __proto__: ConfigurableMenus.MenuFactory.prototype,

   _init: function() {
      ConfigurableMenus.MenuFactory.prototype._init.call(this);
      this._showBoxPointer = true;
      this._openSubMenu = false;
      this._closeSubMenu = false;
      this._floatingMenu = false;
      this._floatingSubMenu = true;
      this._alignSubMenu = false;
      this._showItemIcon = true;
      this._desaturateItemIcon = false;
      this._openOnHover = false;
      this._arrowSide = St.Side.BOTTOM;
      this._effectType = "none";
      this._effectTime = 0.4;
   },

   setMainMenuArrowSide: function(arrowSide) {
      if(this._arrowSide != arrowSide) {
         this._arrowSide = arrowSide;
         for(let pos in this._menuLinkend) {
            let shellMenu = this._menuLinkend[pos];
            if(shellMenu)
               shellMenu.setArrowSide(this._arrowSide);
         }
      }
   },

   setOpenOnHover: function(openOnHover) {
      if(this._openOnHover != openOnHover) {
         this._openOnHover = openOnHover;
         for(let pos in this._menuLinkend) {
            let shellMenu = this._menuLinkend[pos];
            if(shellMenu)
               shellMenu.setOpenOnHover(this._openOnHover);
         }
      }
   },

   setEffect: function(effect) {
      if(this._effectType != effect) {
         this._effectType = effect;
         for(let pos in this._menuManager) {
            this._menuManager[pos].setEffect(this._effectType);
         }
      }
   },

   setEffectTime: function(effectTime) {
      if(this._effectTime != effectTime) {
         this._effectTime = effectTime;
         for(let pos in this._menuManager) {
            this._menuManager[pos].setEffectTime(this._effectTime);
         }
      }
   },

   setFloatingState: function(floating) {
      if(this._floatingMenu != floating) {
         this._floatingMenu = floating;
         for(let pos in this._menuLinkend) {
            let shellMenu = this._menuLinkend[pos];
            if(shellMenu) {
               shellMenu.setFloatingState(this._floatingMenu);
            }
         }
      }
   },

   showBoxPointer: function(show) {
      if(this._showBoxPointer != show) {
         this._showBoxPointer = show;
         for(let pos in this._menuManager) {
            this._menuManager[pos].showBoxPointer(this._showBoxPointer);
         }
      }
   },

   setAlignSubMenu: function(align) {
      if(this._alignSubMenu != align) {
         this._alignSubMenu= align;
         for(let pos in this._menuManager) {
            this._menuManager[pos].setAlignSubMenu(this._alignSubMenu);
         }
      }
   },

   setOpenSubMenu: function(openSubMenu) {
      if(this._openSubMenu != openSubMenu) {
         this._openSubMenu = openSubMenu;
         for(let pos in this._menuManager) {
            this._menuManager[pos].setOpenSubMenu(this._openSubMenu);
         }
      }
   },

   setCloseSubMenu: function(closeSubMenu) {
      if(this._closeSubMenu != closeSubMenu) {
         this._closeSubMenu = closeSubMenu;
         for(let pos in this._menuManager) {
            this._menuManager[pos].setCloseSubMenu(this._closeSubMenu);
         }
      }
   },

   setFloatingSubMenu: function(floating) {
      if(this._floatingSubMenu != floating) {
         this._floatingSubMenu = floating;
         for(let pos in this._menuManager) {
            this._menuManager[pos].setFloatingSubMenu(this._floatingSubMenu);
         }
      }
   },

   setIconVisible: function(show) {
      if(this._showItemIcon != show) {
         this._showItemIcon = show;
         for(let pos in this._menuManager) {
            this._menuManager[pos].setIconVisible(this._showItemIcon);
         }
      }
   },

   desaturateItemIcon: function(desaturate) {
      if(this._desaturateItemIcon != desaturate) {
         this._desaturateItemIcon = desaturate;
         for(let pos in this._menuManager) {
            this._menuManager[pos].desaturateItemIcon(this._desaturateItemIcon);
         }
      }
   },

   _createShellItem: function(factoryItem, launcher, orientation, menuManager) {
      // Decide whether it's a submenu or not
      this._arrowSide = orientation;
      if(menuManager) {
         menuManager.showBoxPointer(this._showBoxPointer);
         menuManager.setOpenSubMenu(this._openSubMenu);
         menuManager.setCloseSubMenu(this._closeSubMenu);
         menuManager.setAlignSubMenu(this._alignSubMenu);
         menuManager.setIconVisible(this._showItemIcon);
         menuManager.desaturateItemIcon(this._desaturateItemIcon);
         menuManager.setEffect(this._effectType);
         menuManager.setEffectTime(this._effectTime);
      }
      let shellItem = null;
      let itemType = factoryItem.getFactoryType();
      if(itemType == ConfigurableMenus.FactoryClassTypes.RootMenuClass)
         shellItem = new ConfigurableMenus.ConfigurableMenuApplet(launcher, orientation, menuManager);
      if(itemType == ConfigurableMenus.FactoryClassTypes.SubMenuMenuItemClass)
         shellItem = new ConfigurableMenus.ConfigurablePopupSubMenuMenuItem("FIXME", true);
      else if(itemType == ConfigurableMenus.FactoryClassTypes.MenuSectionMenuItemClass)
         shellItem = new ConfigurableMenus.ConfigurablePopupMenuSection();
      else if(itemType == ConfigurableMenus.FactoryClassTypes.SeparatorMenuItemClass)
         shellItem = new ConfigurableMenus.ConfigurableSeparatorMenuItem();
      else if(itemType == ConfigurableMenus.FactoryClassTypes.MenuItemClass)
         shellItem = new ConfigurableMenus.ConfigurableApplicationMenuItem("FIXME");
      //else
      //    throw new TypeError('Trying to instantiate a shell item with an invalid factory type');
      if(itemType == ConfigurableMenus.FactoryClassTypes.RootMenuClass) {
         shellItem.setFloatingState(this._floatingMenu);
         shellItem.setOpenOnHover(this._openOnHover);
      } else if(itemType == ConfigurableMenus.FactoryClassTypes.SubMenuMenuItemClass) {
         shellItem.menu.setFloatingState(this._floatingSubMenu);
      }
      return shellItem;
   },
};

function MyApplet() {
   this._init.apply(this, arguments);
}

MyApplet.prototype = {
   __proto__: Applet.Applet.prototype,

   _init: function(metadata, orientation, panelHeight, instanceId) {
      Applet.Applet.prototype._init.call(this, orientation, panelHeight, instanceId);
      try {
         this.uuid = metadata["uuid"];
         this.orientation = orientation;
         this.execInstallLanguage();

         this.set_applet_tooltip(_("Gnome Global Application Menu"));

         this.currentWindow = null;
         this.sendWindow = null;
         this.showAppIcon = true;
         this.showAppName = true;
         this.desaturateAppIcon = false;
         this.maxAppNameSize = 10;
         this.automaticActiveMainMenu = true;
         this.openActiveSubmenu = false;
         this.closeActiveSubmenu = false;
         this.showBoxPointer = true;
         this.alignMenuLauncher = false;
         this.showItemIcon = true;
         this.desaturateItemIcon = false;
         this.openOnHover = false;
         this._keybindingTimeOut = 0;
         this.effectType = "none";
         this.effectTime = 0.4;
         this.replaceAppMenu = false;

         this.appmenu = null;
         this.targetApp = null;
         this._appMenuNotifyId = 0;
         this._actionGroupNotifyId = 0;
         this._busyNotifyId = 0;

         this.gradient = new ConfigurableMenus.GradientLabelMenuItem("", 10);
         this.actor.add(this.gradient.actor);
         this.actor.connect("enter-event", Lang.bind(this, this._onAppletEnterEvent));

         this.menuFactory = new MyMenuFactory();
         this._system = new IndicatorAppMenuWatcher.SystemProperties();

         // Swap applet_context_menu to Configurable Menu Api.
         this._menuManager.removeMenu(this._applet_context_menu);
         this._applet_context_menu.destroy();
         this._applet_context_menu = new ConfigurableMenus.ConfigurableMenu(this, 0.0, orientation, true);
         this._menuManager = new ConfigurableMenus.ConfigurableMenuManager(this);
         this._menuManager.addMenu(this._applet_context_menu);
         this.defaultIcon = new St.Icon({ icon_name: "view-app-grid-symbolic", icon_type: St.IconType.FULLCOLOR, style_class: 'popup-menu-icon' });
         this.hubProvider = new HudProvider.HudSearchProvider();
         this.hudMenuSearch = new HudSearch.GlobalMenuSearch(this.gradient);
         this._menuManager.addMenu(this.hudMenuSearch);

         this._createSettings();
         this._cleanAppmenu();
         this.indicatorDbus = null;
         this._indicatorId = 0;
         this._showsAppMenuId = 0;
         this._overviewHidingId = 0;
         this._overviewShowingId = 0;
         this._appStateChangedSignalId = 0;
         this._switchWorkspaceNotifyId = 0;
         //this._focusAppNotifyId = 0;

         this._gtkSettings = Gtk.Settings.get_default();
         this.appSys = Shell.AppSystem.get_default();
         //this.tracker = Shell.WindowTracker.get_default();
         Main.sessionMode.connect('updated', Lang.bind(this, this._sessionUpdated));
         this._sessionUpdated();
      } catch(e) {
         Main.notify("Init error %s".format(e.message));
         global.logError("Init error %s".format(e.message));
      }
   },

   _sessionUpdated: function() {
      let sensitive = !Main.sessionMode.isLocked && !Main.sessionMode.isGreeter;
      if(!this.indicatorDbus || (sensitive && !this.indicatorDbus.isWatching())) {
         this.indicatorDbus = new IndicatorAppMenuWatcher.IndicatorAppMenuWatcher(
            IndicatorAppMenuWatcher.AppmenuMode.MODE_STANDARD, this._getIconSize()
         );
         this._isReady = this._initEnvironment();
         if(this._isReady) {
             this.indicatorDbus.watch();
             this.hubProvider.setIndicator(this.indicatorDbus, this.currentWindow);
             this.hudMenuSearch.setIndicator(this.indicatorDbus, this.currentWindow);
             if(this._indicatorId == 0) {
                 this._indicatorId = this.indicatorDbus.connect('appmenu-changed', Lang.bind(this, this._onAppmenuChanged));
                 this._onAppmenuChanged(this.indicatorDbus, this.currentWindow);
             }
             if(this._showsAppMenuId == 0) {
                 this._showsAppMenuId = this._gtkSettings.connect('notify::gtk-shell-shows-app-menu',
                                                           Lang.bind(this, this._onShowAppMenuChanged));
             }
             //if(this._focusAppNotifyId == 0) {
             //    this._focusAppNotifyId = this.tracker.connect('notify::focus-app', Lang.bind(this, this._onAppMenuNotify));
             //}
             if(this._overviewHidingId == 0) {
                 this._overviewHidingId = Main.overview.connect('hiding', Lang.bind(this, this._onAppMenuNotify));
             }
             if(this._overviewShowingId == 0) {
                 this._overviewShowingId = Main.overview.connect('showing', Lang.bind(this, this._onAppMenuNotify));
             }
             if(this._appStateChangedSignalId == 0) {
                 this._appStateChangedSignalId = this.appSys.connect('app-state-changed', Lang.bind(this, this._onAppMenuNotify));
             }
             if(this._switchWorkspaceNotifyId == 0) {
                 this._switchWorkspaceNotifyId = global.window_manager.connect('switch-workspace',
                                                                        Lang.bind(this, this._onAppMenuNotify));
             }
         } else {
             Main.notify(_("You need restart your computer, to active the unity-gtk-module"));
         }
      }
   },

   _onButtonPressEvent: function (actor, event) {
      if (this._applet_enabled) {
         if (event.get_button() == 1) {
            if (!this._draggable.inhibit) {
               if (this._applet_context_menu.isOpen) {
                  this._applet_context_menu.toggle();
               }
               return this.on_applet_clicked(event);
            }
         }
         if (event.get_button() == 3) {
            if (this._applet_context_menu.getMenuItems().length > 0) {
               this._applet_context_menu.toggle();
            }
         }
      }
      return true;
   },

   _createSettings: function() {
      this.settings = new Settings.AppletSettings(this, this.uuid, this.instance_id);
      this.settings.bindProperty(Settings.BindingDirection.IN, "enable-search-provider", "enableProvider", this._onEnableProviderChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "enable-environment", "enableEnvironment", this._onEnableEnvironmentChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "replace-appmenu", "replaceAppMenu", this._onReplaceAppMenuChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "enable-jayantana", "enableJayantana", this._onEnableJayantanaChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "show-app-icon", "showAppIcon", this._onShowAppIconChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "desaturate-app-icon", "desaturateAppIcon", this._onDesaturateAppIconChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "show-app-name", "showAppName", this._onShowAppNameChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "text-gradient", "textGradient", this._onTextGradientChange, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "max-app-name-size", "maxAppNameSize", this._onMaxAppNameSizeChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "automatic-active-mainmenu", "automaticActiveMainMenu", this._automaticActiveMainMenuChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "open-active-submenu", "openActiveSubmenu", this._onOpenActiveSubmenuChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "close-active-submenu", "closeActiveSubmenu", this._onCloseActiveSubmenuChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "show-boxpointer", "showBoxPointer", this._onShowBoxPointerChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "align-menu-launcher", "alignMenuLauncher", this._onAlignMenuLauncherChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "global-overlay-key", "overlayKey", this._updateKeybinding, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "hud-overlay-key", "hudOverlayKey", this._updateHudKeybinding, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "num-items", "numbreOfItems", this._updateNumbreOfItems, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "display-in-panel", "displayInPanel", this._onDisplayInPanelChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "show-item-icon", "showItemIcon", this._onShowItemIconChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "desaturate-item-icon", "desaturateItemIcon", this._onDesaturateItemIconChanged, null);

      this.settings.bindProperty(Settings.BindingDirection.IN, "activate-on-hover", "openOnHover", this._onOpenOnHoverChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "effect", "effectType", this._onEffectTypeChanged, null);
      this.settings.bindProperty(Settings.BindingDirection.IN, "effect-time", "effectTime", this._onEffectTimeChanged, null);

      this._onEnableProviderChanged();
      this._onEnableEnvironmentChanged();
      this._onEnableJayantanaChanged();
      this._onDisplayInPanelChanged();
      this._onShowAppIconChanged();
      this._onDesaturateAppIconChanged();
      this._onShowAppNameChanged();
      this._onTextGradientChange();
      this._onMaxAppNameSizeChanged();
      this._updateKeybinding();
      this._updateHudKeybinding();
      this._updateNumbreOfItems();

      this._onOpenActiveSubmenuChanged();
      this._onCloseActiveSubmenuChanged();
      this._onShowBoxPointerChanged();
      this._onAlignMenuLauncherChanged();
      this._onShowItemIconChanged();
      this._onDesaturateItemIconChanged();
      this._onOpenOnHoverChanged();
      this._onEffectTypeChanged();
      this._onEffectTimeChanged();
      this._onReplaceAppMenuChanged();
   },

   _initEnvironment: function() {
      let isReady = this._system.activeUnityGtkModule(true);
      if(isReady) {
         this._system.activeJAyantanaModule(this.enableJayantana);
         //this._system.shellShowAppmenu(true); Is controlled
         this._system.shellShowMenubar(true);
         this._system.activeQtPlatform(true);
         this._system.activeUnityMenuProxy(true);
         return true;
      }
      return false;
   },

   openAbout: function() {
      if(Applet.Applet.prototype.openAbout)
         Applet.Applet.prototype.openAbout.call(this);
      else
         Main.notify("Missing reference to the About Dialog");
   },

   configureApplet: function() {
      if(Applet.Applet.prototype.configureApplet)
         Applet.Applet.prototype.configureApplet.call(this);
      else
         Util.spawnCommandLine("xlet-settings applet " + this._uuid + " " + this.instance_id);
   },

   finalizeContextMenu: function () {
      // Add default context menus if we're in panel edit mode, ensure their removal if we're not       
      let items = this._applet_context_menu.getMenuItems();

      if (this.context_menu_item_remove == null) {
         this.context_menu_item_remove = new ConfigurableMenus.ConfigurableBasicPopupMenuItem(_("Remove '%s'").format(_(this._meta.name)));
         this.context_menu_item_remove.setIconName("edit-delete");
         this.context_menu_item_remove.setIconVisible(true);
         this.context_menu_item_remove.setIconType(St.IconType.SYMBOLIC);
         this.context_menu_item_remove.connect('activate', Lang.bind(this, function() {
               let enabled = global.settings.get_strv('enabled-extensions');
               let index = enabled.indexOf(MyExtension.uuid);
               if (index > -1) {
                  enabled.splice(index, 1);
               }
               global.settings.set_strv('enabled-extensions', enabled);
         }));
      }
      if (this.context_menu_item_about == null) {
         this.context_menu_item_about = new ConfigurableMenus.ConfigurableBasicPopupMenuItem(_("About..."));
         this.context_menu_item_about.setIconName("dialog-question");
         this.context_menu_item_about.setIconVisible(true);
         this.context_menu_item_about.setIconType(St.IconType.SYMBOLIC);
         this.context_menu_item_about.connect('activate', Lang.bind(this, this.openAbout));
      }

      if (this.context_menu_separator == null) {
         this.context_menu_separator = new ConfigurableMenus.ConfigurableSeparatorMenuItem();
      }

      if (items.indexOf(this.context_menu_item_about) == -1) {
         this._applet_context_menu.addMenuItem(this.context_menu_item_about);
      }
      if (!this._meta["hide-configuration"] && GLib.file_test(MyExtension.path + "/settings-schema.json", GLib.FileTest.EXISTS)) {
         if (this.context_menu_item_configure == null) {            
             this.context_menu_item_configure = new ConfigurableMenus.ConfigurableBasicPopupMenuItem(_("Configure..."));
             this.context_menu_item_configure.setIconName("system-run");
             this.context_menu_item_configure.setIconVisible(true);
             this.context_menu_item_configure.setIconType(St.IconType.SYMBOLIC);
             this.context_menu_item_configure.connect('activate', Lang.bind(this, this.configureApplet));
         }
         if (items.indexOf(this.context_menu_item_configure) == -1) {
             this._applet_context_menu.addMenuItem(this.context_menu_item_configure);
         }
      }

      if (items.indexOf(this.context_menu_item_remove) == -1) {
         this._applet_context_menu.addMenuItem(this.context_menu_item_remove);
      }
   },

   _finalizeEnvironment: function() {
      //this._system.shellShowAppmenu(false);
      this._system.shellShowMenubar(false);
      this._system.activeQtPlatform(false);
      this._system.activeUnityMenuProxy(false);
      this._system.activeJAyantanaModule(false);
      // FIXME When we can call system.activeUnityGtkModule(false)?
      // Is possible that we need to add an option to the settings
      // to be more easy to the user uninstall the applet in a
      // propertly way.
   },

   _onReplaceAppMenuChanged: function() {
      let parent = this.actor.get_parent();
      if(parent)
         parent.remove_actor(this.actor);
      let children = Main.panel._leftBox.get_children();
      if(this.replaceAppMenu) {
         if(Main.panel.statusArea.appMenu) {
            let index = children.indexOf(Main.panel.statusArea.appMenu.container);
            if(index != -1) {
               Main.panel.statusArea.appMenu.destroy();
               //Main.panel.statusArea['appMenu'] = null;
               // Fake appmenu, to avoid the gnome shell behavior.
               Main.panel.statusArea['appMenu'] = new St.Bin();
               Main.panel.statusArea['appMenu'].actor = Main.panel.statusArea['appMenu'];
               Main.panel.statusArea['appMenu'].container = Main.panel.statusArea['appMenu'];
               Main.panel.statusArea['appMenu'].connect = function() {};
               Main.panel._leftBox.insert_child_at_index(this.actor, index);
            } else {
               Main.panel._leftBox.insert_child_at_index(this.actor, index);
            }
         } else {
            Main.panel._leftBox.insert_child_at_index(this.actor, children.length);
         }
      } else {
         if (Main.panel.statusArea.appMenu) {
            Main.panel.statusArea.appMenu.destroy();
            Main.panel.statusArea.appMenu = null;
         }
         let panel = Main.sessionMode.panel;
         Main.panel._updateBox(panel.left, Main.panel._leftBox);
         let children = Main.panel._leftBox.get_children();
         if(Main.panel.statusArea.appMenu) {
            let index = children.indexOf(Main.panel.statusArea.appMenu.container);
            if(index != -1) {
                Main.panel._leftBox.insert_child_at_index(this.actor, index);
            } else {
               Main.panel._leftBox.insert_child_at_index(this.actor, children.length);
            }
         } else {
            Main.panel._leftBox.insert_child_at_index(this.actor, children.length);
         }
      }
   },

   _onEnableProviderChanged: function() {
       if(this.enableProvider) {
          this.hubProvider.enable();
       } else {
          this.hubProvider.disable();
       }
   },

   _onEnableEnvironmentChanged: function() {
      if(this.enableEnvironment != this._system.isEnvironmentSet()) {
         this._system.setEnvironmentVar(this.enableEnvironment, Lang.bind(this, this._envVarChanged));
      }
   },

   _envVarChanged: function(result, error) {
      this.enableEnvironment = result;
      if(error)
         Main.notify(_("The environment variable cannot be changed"));
      else
         Main.notify(_("The environment variable was set, a logout will be required to apply the changes"));
   },

   _onEnableJayantanaChanged: function() {
      this._system.activeJAyantanaModule(this.enableJayantana);
   },

   _updateKeybinding: function() { 	
      this.keybindingManager.addHotKey("global-overlay-key", this.overlayKey, Lang.bind(this, function() {
         if(this.menu && !Main.overview.visible) {
            this.menu.toggleSubmenu(true);
         }
      }));
   },

   _updateHudKeybinding: function() {
      this.keybindingManager.addHotKey("global-hud-key", this.hudOverlayKey, Lang.bind(this, function() {
         if(!Main.overview.visible) {
            this.hudMenuSearch.toggle(true);
         }
      }));
   },

   _updateNumbreOfItems: function() {
      this.hudMenuSearch.setMaxNumberOfItems(this.numbreOfItems);
   },

   _onEffectTypeChanged: function() {
      this.menuFactory.setEffect(this.effectType);
   },

   _onEffectTimeChanged: function() {
      this.menuFactory.setEffectTime(this.effectTime);
   },

   _onOpenOnHoverChanged: function() {
      this.menuFactory.setOpenOnHover(this.openOnHover);
   },

   _onDisplayInPanelChanged: function() {
      this.menuFactory.setFloatingState(!this.displayInPanel);
   },

   _onShowAppIconChanged: function() {
      this.gradient.showIcon(this.showAppIcon);
   },

   _onDesaturateAppIconChanged: function() {
      this.gradient.desaturateIcon(this.desaturateAppIcon);
   },

   _onShowAppNameChanged: function() {
      this.gradient.actor.visible = this.showAppName;
   },

   _onTextGradientChange: function() {
      this.gradient.setTextDegradation(this.textGradient);
   },

   _onMaxAppNameSizeChanged: function() {
      this.gradient.setSize(this.maxAppNameSize);
   },

   _automaticActiveMainMenuChanged: function() {
      if(this.automaticActiveMainMenu)
         this._closeMenu();
   },

   _onOpenActiveSubmenuChanged: function() {
      this.menuFactory.setOpenSubMenu(this.openActiveSubmenu);
   },

   _onCloseActiveSubmenuChanged: function() {
      this.menuFactory.setCloseSubMenu(this.closeActiveSubmenu);
   },

   _onShowBoxPointerChanged: function() {
      this.menuFactory.showBoxPointer(this.showBoxPointer);
      if(this._applet_context_menu.showBoxPointer)
         this._applet_context_menu.showBoxPointer(this.showBoxPointer);
   },

   _onAlignMenuLauncherChanged: function() {
      this.menuFactory.setAlignSubMenu(this.alignMenuLauncher);
   },

   _onShowItemIconChanged: function() {
      this.menuFactory.setIconVisible(this.showItemIcon);
   },

   _onDesaturateItemIconChanged: function() {
      this.menuFactory.desaturateItemIcon(this.desaturateItemIcon);
   },

   setAppMenu: function(menu) {
      if (this.appmenu) 
         this.appmenu.destroy();
      this.appmenu = null;
      if (this.menu && menu && this._gtkSettings.gtk_shell_shows_app_menu) {
         this.menu.setStartCounter(0);
         let tempName = "FIXME";
         if(this.targetApp != null)
            tempName = this.targetApp.get_name();
         this.appmenu = new ConfigurableMenus.ConfigurablePopupSubMenuMenuItem(tempName, false);
         this.appmenu.setFloatingSubMenu(true);
         this.appmenu.setMenu(menu);
         this.appmenu.actor.add_style_class_name('panel-menu');
         menu.actor.hide();

         this.menu.addMenuItem(this.appmenu, null, 0);
         this.menu.setStartCounter(1);
      }
      this.emit('menu-set');
   },

   _onShowAppMenuChanged: function() {
      if(!this._gtkSettings.gtk_shell_shows_app_menu) {
          this.setAppMenu(null);
      } else {
          this._onAppMenuNotify();
      }
   },

   _onAppMenuNotify: function() {
       let visible = (this.targetApp != null &&
                      !Main.overview.visibleTarget &&
                      this.targetApp.is_on_workspace(global.screen.get_active_workspace()));
       if (visible) {
           this.actor.show();
       } else {
          this.actor.hide();
       }
       let isBusy = (this.targetApp != null &&
                     (this.targetApp.get_state() == Shell.AppState.STARTING ||
                      this.targetApp.get_busy()));
       /*if (isBusy)
           this.startAnimation();
       else
           this.stopAnimation();*/

      this.actor.reactive = (visible && !isBusy);

      let menu = null;
      if (this.targetApp && this.targetApp.action_group && this.targetApp.menu) {
         if (this.appmenu instanceof RemoteMenu.RemoteMenu &&
            this.appmenu.actionGroup == this.targetApp.action_group)
            return;

         menu = new RemoteMenu.RemoteMenu(this.actor, this.targetApp.menu, this.targetApp.action_group);
         menu.connect('activate', Lang.bind(this, function() {
            let win = this.targetApp.get_windows()[0];
            win.check_alive(global.get_current_time());
         }));
      }

      this.setAppMenu(menu);
   },

   _onAppmenuChanged: function(indicator, window) {
      let newLabel = null;
      let newIcon = null;
      let newMenu = null;
      let app = null;
      this.currentWindow = window;
      if(this.currentWindow) {
         app = this.indicatorDbus.getAppForWindow(this.currentWindow);
         if(app) {
            newIcon = this.indicatorDbus.getIconForWindow(this.currentWindow);
            newLabel = app.get_name();
            let dbusMenu = this.indicatorDbus.getRootMenuForWindow(this.currentWindow);
            if(dbusMenu) {
               newMenu = this.menuFactory.getShellMenu(dbusMenu);
               if(!newMenu) {
                  let menuManager = new ConfigurableMenus.ConfigurableMenuManager(this);
                  newMenu = this.menuFactory.buildShellMenu(dbusMenu, this, this.orientation, menuManager);
               }
            }
         }
      }
      this._tryToShow(newLabel, newIcon, newMenu);
      this._tryToTrackAppMenu(app);
   },

   _tryToTrackAppMenu: function(app) {
      if(this.targetApp != app) {
         if (this._appMenuNotifyId != 0) {
            this.targetApp.disconnect(this._appMenuNotifyId);
            this._appMenuNotifyId = 0;
         }
         if (this._actionGroupNotifyId != 0) {
            this.targetApp.disconnect(this._actionGroupNotifyId);
            this._actionGroupNotifyId = 0;
         }
         if (this._busyNotifyId != 0) {
            this.targetApp.disconnect(this._busyNotifyId);
            this._busyNotifyId = 0;
         }
         this.targetApp = app;
         if (this.targetApp) {
            this._appMenuNotifyId = this.targetApp.connect('notify::menu', Lang.bind(this, this._onAppMenuNotify));
            this._actionGroupNotifyId = this.targetApp.connect('notify::action-group', Lang.bind(this, this._onAppMenuNotify));
            this._busyNotifyId = this.targetApp.connect('notify::busy', Lang.bind(this, this._onAppMenuNotify));
         }
      }
      this._onAppMenuNotify();
   },

   _tryToShow: function(newLabel, newIcon, newMenu) {
      if((newLabel != null)&&(newIcon != null)) {
         this._changeAppmenu(newLabel, newIcon, newMenu);
      } else  {
         this._cleanAppmenu();
      } 
   },

   _changeAppmenu: function(newLabel, newIcon, newMenu) {
      if(newMenu != this.menu) {
         this._closeMenu();
         this.menu = newMenu;
         if(this.menu && this.automaticActiveMainMenu && !this.menu.isInFloatingState())
            this.menu.open();
      }
      this.gradient.setText(newLabel);
      if(newIcon != this.gradient.getIcon()) {
         if(this.gradient.getIcon())
             this.gradient.getIcon().destroy();
         this.gradient.setIcon(newIcon);
      }
   },

   _closeMenu: function() {
      if((this.menu)&&(this.menu.isOpen)) {
         this.menu.close(false, true);
         this.sendWindow = null;
      }
   },

   _cleanAppmenu: function() {
      this._closeMenu();
      this.menu = null;
      //this.gradient.setIcon(this.defaultIcon);
      //this.gradient.setText(_("Activities"));
      this.gradient.setIcon(null);
      this.gradient.setText("");
   },

   _getIconSize: function() {
      let iconSize;
      let ui_scale = global.ui_scale;
      if(!ui_scale) ui_scale = 1;
      if(this._scaleMode)
         iconSize = this._panelHeight * Applet.COLOR_ICON_HEIGHT_FACTOR / ui_scale;
      else
         iconSize = Applet.FALLBACK_ICON_HEIGHT;
      return iconSize;
   },

   _onAppletEnterEvent: function() {
      if(this.currentWindow) {
         if(this.indicatorDbus && (this.currentWindow != this.sendWindow)) {
            this.indicatorDbus.updateMenuForWindow(this.currentWindow);
            this.sendWindow = this.currentWindow;
         }
      }
      if((this.menu)&&(this.openOnHover))
         this.menu.open(true);
   },

   on_orientation_changed: function(orientation) {
      this.orientation = orientation;
      this.menuFactory.setMainMenuArrowSide(orientation);
      this._applet_context_menu.setArrowSide(orientation);
   },

   on_panel_height_changed: function() {
      let iconSize = this._getIconSize();
      if(this.indicatorDbus) {
         this.indicatorDbus.setIconSize(iconSize);
         this._onAppmenuChanged(this.indicatorDbus, this.currentWindow);
      }
   },

   on_applet_added_to_panel: function() {
      this._onReplaceAppMenuChanged();
      Applet.Applet.prototype.on_applet_added_to_panel.call(this);
   },

   on_applet_removed_from_panel: function() {
      let temp = this.replaceAppMenu;
      this.replaceAppMenu = false;
      this._onReplaceAppMenuChanged();
      this.replaceAppMenu = temp;
      let parent = this.actor.get_parent();
      if(parent) {
         parent.remove_actor(this.actor);
      }
      if(this.indicatorDbus) {
          if(this._indicatorId != 0) {
              this.indicatorDbus.disconnect(this._indicatorId);
              this._indicatorId = 0;
          }
          this.indicatorDbus.destroy();
          this.indicatorDbus = null;
      }
      this._finalizeEnvironment();
      this.keybindingManager.destroy();
      this.hubProvider.disable();
      if(this._overviewHidingId != 0) {
         Main.overview.disconnect(this._overviewHidingId);
         this._overviewHidingId = 0;
      }
      if(this._overviewShowingId != 0) {
         Main.overview.disconnect(this._overviewShowingId);
         this._overviewShowingId = 0;
      }
      if(this._showsAppMenuId) {
         this._gtkSettings.disconnect(this._showsAppMenuId);
         this._showsAppMenuId = 0;
      }
      if(this._appStateChangedSignalId != 0) {
         this.appSys.disconnect(this._appStateChangedSignalId);
         this._appStateChangedSignalId = 0;
      }
      if(this._switchWorkspaceNotifyId != 0) {
         global.window_manager.disconnect(this._switchWorkspaceNotifyId);
         this._switchWorkspaceNotifyId = 0;
      }
      if(this.targetApp) {
         if (this._appMenuNotifyId != 0)
            this.targetApp.disconnect(this._appMenuNotifyId);
         if (this._actionGroupNotifyId != 0)
            this.targetApp.disconnect(this._actionGroupNotifyId);
         if (this._busyNotifyId != 0)
            this.targetApp.disconnect(this._busyNotifyId);
      }
   },

   on_applet_clicked: function(event) {
      if((this.menu) && (event.get_button() == 1)) {
         this.menu.forcedToggle();
         //if (Main.overview.shouldToggleByCornerOrButton())
         //    Main.overview.toggle();
         return true;
      }
      return false;
   },

   execInstallLanguage: function() {
      let localeFolder = Gio.file_new_for_path(GLib.get_home_dir() + "/.local/share/locale");
      Gettext.bindtextdomain(this.uuid, localeFolder.get_path());
      try {
         let moFolder = Gio.file_new_for_path(localeFolder.get_parent().get_path() + "/gnome-shell/extensions/" + this.uuid + "/po/mo/");
         let children = moFolder.enumerate_children('standard::name,standard::type,time::modified',
                                                     Gio.FileQueryInfoFlags.NONE, null);
         let info, child, moFile, moLocale, moPath, src, dest, modified, destModified;
         while((info = children.next_file(null)) != null) {
            modified = info.get_modification_time().tv_sec;
            if(info.get_file_type() == Gio.FileType.REGULAR) {
               moFile = info.get_name();
               if(moFile.substring(moFile.lastIndexOf(".")) == ".mo") {
                  moLocale = moFile.substring(0, moFile.lastIndexOf("."));
                  moPath = localeFolder.get_path() + "/" + moLocale + "/LC_MESSAGES/";
                  src = Gio.file_new_for_path(String(moFolder.get_path() + "/" + moFile));
                  dest = Gio.file_new_for_path(String(moPath + this.uuid + ".mo"));
                  try {
                     if(dest.query_exists(null)) {
                        destModified = dest.query_info('time::modified', Gio.FileQueryInfoFlags.NONE, null).get_modification_time().tv_sec;
                        if((modified > destModified)) {
                           src.copy(dest, Gio.FileCopyFlags.OVERWRITE, null, null);
                        }
                     } else {
                         this._makeDirectoy(dest.get_parent());
                         src.copy(dest, Gio.FileCopyFlags.OVERWRITE, null, null);
                     }
                  } catch(e) {
                     global.logWarning("Error %s".format(e.message));
                  }
               }
            }
         }
      } catch(e) {
         global.logWarning("Error %s".format(e.message));
      }
   },

   _isDirectory: function(fDir) {
      try {
         let info = fDir.query_filesystem_info("standard::type", null);
         if((info)&&(info.get_file_type() != Gio.FileType.DIRECTORY))
            return true;
      } catch(e) {
      }
      return false;
   },

   _makeDirectoy: function(fDir) {
      if(!this._isDirectory(fDir))
         this._makeDirectoy(fDir.get_parent());
      if(!this._isDirectory(fDir))
         fDir.make_directory(null);
   },
};

function main(metadata, orientation, panel_height, instance_id) {
   let myApplet = new MyApplet(metadata, orientation, panel_height, instance_id);
   return myApplet;
}
