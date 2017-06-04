// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const Signals = imports.signals;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Mainloop = imports.mainloop;

const Search = imports.ui.search;
const Main = imports.ui.main;
const IconGrid = imports.ui.iconGrid;
const AppDisplay = imports.ui.appDisplay;

const MyExtension = imports.misc.extensionUtils.getCurrentExtension();
const ConfigurableMenus = MyExtension.imports.configurableMenus;

const MAX_LIST_SEARCH_RESULTS_ROWS = 20;
var hudSearchProvider = null;

function GlobalMenuSearch() {
   this._init.apply(this, arguments);
}

GlobalMenuSearch.prototype = {
    __proto__: ConfigurableMenus.ConfigurableMenu.prototype,

    _init: function(launcher) {
        ConfigurableMenus.ConfigurableMenu.prototype._init.call (this, launcher, 0.0, St.Side.TOP, true);
        this.actor.add_style_class_name("hud-menu");
        this.indicator = null;
        this.currentWindow = null;
        this.appData = null;
        this._indicatorId = 0;
        this.isEnabled = true;

        let searchBox = new ConfigurableMenus.ConfigurablePopupMenuSection();
        this.entryBox = new ConfigurableMenus.ConfigurableEntryItem("", "Search");
        searchBox.addMenuItem(this.entryBox);
        this.itemsBox = new ConfigurableMenus.ArrayBoxLayout();
        this.addMenuItem(searchBox);
        this.addMenuItem(this.itemsBox);
        this.itemsBox.scrollBox.setAutoScrolling(true);

        this.setMaxHeight();
        this.connect('open-state-changed', Lang.bind(this, this._onMenuOpenStateChanged));
        this.entryBox.connect('text-changed', Lang.bind(this, this._onTextChanged));
        this.entryBox.searchEntryText.connect('key-press-event', Lang.bind(this, this._onKeyPressEvent));
    },

    _onKeyPressEvent: function(actor, event) {
        let symbol = event.get_key_symbol();
        if(this.isOpen) {
            let items = this.itemsBox.getAllMenuItems();
            if(!this._activeMenuItem) {
                this._activeMenuItem = items[0];
                this._activeMenuItem.setActive(true);
            }
            if(symbol == Clutter.Escape) {
                this.close(true);
                return true;
            } else if(symbol == Clutter.KEY_Return) {
                this._activeMenuItem.activate();
                return true;
            }
            let index = items.indexOf(this._activeMenuItem);
            if(symbol == Clutter.KEY_Down) {
                this._activeMenuItem.setActive(false);
                if(index < items.length - 1)
                    this._activeMenuItem = items[index+1];
                else
                    this._activeMenuItem = items[0];
                this._activeMenuItem.setActive(true);
                this.itemsBox.scrollBox.scrollToActor(this._activeMenuItem.actor);
                return true;
            } else if(symbol == Clutter.KEY_Up) {
                this._activeMenuItem.setActive(false);
                if(index > 0)
                    this._activeMenuItem = items[index-1];
                else
                    this._activeMenuItem = items[items.length - 1];
                this._activeMenuItem.setActive(true);
                this.itemsBox.scrollBox.scrollToActor(this._activeMenuItem.actor);
                return true;
            }
        }
        return false;
    },

    _onMenuOpenStateChanged: function(menu, open) {
        if(open) {
            this.isOpen
            this.entryBox.grabKeyFocus();
            Mainloop.idle_add(Lang.bind(this, function() {
                let items = this.itemsBox.getAllMenuItems();
                if(items.length > 0) {
                    this._activeMenuItem = items[0];
                    this._activeMenuItem.setActive(true);
                }
            }));
        } else {
            this.entryBox.setText("");
            if(this._activeMenuItem) {
                this._activeMenuItem.setActive(false);
                this._activeMenuItem = null;
            }
            this.itemsBox.removeAllMenuItems();
        }
    },

    _onTextChanged: function(actor, event) {
        if(!this.isChanging) {
            this.itemsBox.removeAllMenuItems();
            if(this.indicator && this.appData && this.appData["dbusMenu"]) {
                let text = this.entryBox.getText();
                let terms = text.trim().split(/\s+/);
                let ids = this._search(terms);
                let items = this.appData["dbusMenu"].getItems();
                for(let pos in ids) {
                    let id = ids[pos];
                    if(id in items) {
                        let item = items[id];
                        let label = this.buildLabelForItem(item);
                        if(label.length > 0) {
                            let componnet = new ConfigurableMenus.ConfigurableApplicationMenuItem(label, { focusOnHover: false });
                            componnet.setGIcon(item.getIcon(16));
                            componnet.setAccel(item.getAccel());
                            if(item.getToggleType() == "checkmark") {
                                componnet.setOrnament(ConfigurableMenus.OrnamentType.CHECK, item.getToggleState());
                            } else if(item.getToggleType() == "radio") {
                                componnet.setOrnament(ConfigurableMenus.OrnamentType.DOT, item.getToggleState());
                            } else {
                                componnet.setOrnament(ConfigurableMenus.OrnamentType.NONE);
                            }
                            componnet.connect('activate', Lang.bind(this, this._onActivateResult, item, terms));
                            this.itemsBox.addMenuItem(componnet);
                        }
                    }
                }
                let menuItems = this.itemsBox.getAllMenuItems();
                if(menuItems.length > 0) {
                    this._activeMenuItem = menuItems[0];
                    this._activeMenuItem.setActive(true); 
                }
            }
        }
    },

    buildLabelForItem: function(item) {
        let label = item.getLabel();
        while(item.getParent() != null) {
            item = item.getParent();
            if (item.getLabel())
                label = item.getLabel() + " ➩ " + label;
        }
        return label;
    },

    setIndicator: function(indicator) {
        if(this.indicator != indicator) {
            if(this.indicator && (this._indicatorId > 0)) {
                this.indicator.disconnect(this._indicatorId);
                this._indicatorId = 0;
            }
            this.indicator = indicator;
            if(this.indicator && (this._indicatorId == 0)) {
                this._indicatorId = this.indicator.connect('appmenu-changed', Lang.bind(this, this._onAppmenuChanged));
            }
        }
    },

    _onAppmenuChanged: function(indicator, window)  {
        if(this.currentWindow != window) {
            this.appData = null;
            this.currentWindow = window;
            if(this.currentWindow && this.indicator && this.isEnabled) {
                let app = this.indicator.getAppForWindow(window);
                if(app) {
                    this.appData = {
                        "icon": this.indicator.getIconForWindow(window),
                        "label": app.get_name(),
                        "dbusMenu": this.indicator.getMenuForWindow(window)
                    };
                }
            }
        }
    },

    _onActivateResult: function(self, event, keepMenu, item, terms) {
        if(this.indicator && this.appData && this.appData["dbusMenu"]) {
            item.active();
        }
    },

    _searchFor: function(item, terms) {
        let label = item.getLabel().toLowerCase();
        for(let pos in terms) {
            if(label.indexOf(terms[pos].toLowerCase()) != -1) {
                return 1;
            }
        }
        return 0;
    },

    _search: function(terms) {
        let results = [];
        if(this.indicator && this.appData && this.appData["dbusMenu"]) {
            let items = this.appData["dbusMenu"].getItems();
            for(let id in items) {
                let item = items[id];
                let sResult = this._searchFor(item, terms);
                if((item.getFactoryType() == ConfigurableMenus.FactoryClassTypes.MenuItemClass) && (sResult > 0)) {
                    results.push(id);
                }
            }
        }
        return results;
    },

    // Setting the max-height won't do any good if the minimum height of the
    // menu is higher then the screen; it's useful if part of the menu is
    // scrollable so the minimum height is smaller than the natural height
    setMaxHeight: function() {
        let workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
        let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        let verticalMargins = this.actor.margin_top + this.actor.margin_bottom;

        // The workarea and margin dimensions are in physical pixels, but CSS
        // measures are in logical pixels, so make sure to consider the scale
        // factor when computing max-height
        let maxHeight = Math.round(40 * (workArea.height - verticalMargins) / (100*scaleFactor));
        this.actor.style = ('max-height: %spx;').format(maxHeight);
    },
};
