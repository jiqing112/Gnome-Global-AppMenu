const Lang = imports.lang;
const Gettext = imports.gettext;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;

const _ = Gettext.gettext;

const SettingsWidgets = cimports.settings.settingsWidgets;

const SETTINGS_GROUP_NAME = "Settings";
var instance = null;

function get_editor() {
    if (instance == null)
        instance = new GtkSettingsEditor();

    return instance;
}

const GtkSettingsEditor = new GObject.Class({
    Name: 'ClassicGnome.GtkSettingsEditor',
    GTypeName: 'ClassicGnomeGtkSettingsEditor',

    _init: function() {
        this._path = GLib.build_filenamev([
            GLib.get_user_config_dir(), "gtk-3.0", "settings.ini"
        ]);
    },

    _get_keyfile: function() {
        let keyfile = null;
        try {
            keyfile = new GLib.KeyFile();
            keyfile.load_from_file(this._path, 0);
        } catch(e) {
            global.log("Error: " + e);
        }
        return keyfile;
    },

    get_boolean: function(key) {
        let result;
        let keyfile = this._get_keyfile();
        try {
            result = keyfile.get_boolean(SETTINGS_GROUP_NAME, key);
        } catch(e) {
            result = false;
        }
        return result;
    },

    set_boolean: function(key, value) {
        let keyfile = this._get_keyfile();
        try {
            keyfile.set_boolean(SETTINGS_GROUP_NAME, key, value);
            let data = keyfile.to_data();
            GLib.file_set_contents(this._path, data[0]);
        } catch(e) {
        }
    },
});

const GtkSettingsSwitch = new GObject.Class({
    Name: 'ClassicGnome.GtkSettingsSwitch',
    GTypeName: 'ClassicGnomeGtkSettingsSwitch',
    Extends: SettingsWidgets.SettingsWidget,

    _init: function(markup, setting_name) { // setting_name=null
        this.parent(null);

        this.content_widget = new Gtk.Switch();
        this.label = new Gtk.Label();
        this.label.set_markup(markup);
        this.pack_start(this.label, false, false, 0);
        this.pack_end(this.content_widget, false, false, 0);

        this.settings = get_editor();
        this.content_widget.set_active(this.settings.get_boolean(this.setting_name));

        this.content_widget.connect("notify::active", Lang.bind(this, this.clicked));
    },

    clicked: function(widget, data) { //data=null
        this.settings.set_boolean(this.setting_name, this.content_widget.get_active());
    },
});
