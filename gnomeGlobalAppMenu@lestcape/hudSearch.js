// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const Signals = imports.signals;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const GdkPixbuf = imports.gi.GdkPixbuf;

const Search = imports.ui.search;
const Main = imports.ui.main;
const IconGrid = imports.ui.iconGrid;
const AppDisplay = imports.ui.appDisplay;

const MyExtension = imports.misc.extensionUtils.getCurrentExtension();
const ConfigurableMenus = MyExtension.imports.configurableMenus;

const MAX_LIST_SEARCH_RESULTS_ROWS = 20;
var hudSearchProvider = null;

const GlobalSearchMenu = new Lang.Class({

function GlobalSearchMenu() {
   this._init.apply(this, arguments);
}

GlobalSearchMenu.prototype = {
    __proto__: ConfigurableMenus.ConfigurableMenu.prototype,

    _init: function(launcher) {
        ConfigurableMenus.ConfigurableMenu.prototype._init.call (this, launcher, 0.0, St.Side.TOP, true);
        let searchBox = new ConfigurableMenus.ConfigurablePopupMenuSection();
        let entryBox = new ConfigurableMenus.ConfigurableEntryItem();
        searchBox.addMenuItem(entryBox);
        let itemsBox = new ConfigurableMenus.ConfigurablePopupMenuSection();
        this.addMenuItem(searchBox);
        this.addMenuItem(itemsBox);
    },
};
