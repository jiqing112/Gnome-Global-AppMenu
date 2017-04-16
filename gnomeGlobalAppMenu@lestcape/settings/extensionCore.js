/* -*- mode: js; js-basic-offset: 4; indent-tabs-mode: nil -*- */
/* ========================================================================================================
 * extensionCore.js - A library to provide a Side Page for the xlet installation proccess - 
 * ========================================================================================================
 */
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Gettext = imports.gettext;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const GdkPixbuf = imports.gi.GdkPixbuf;
const Gdk = imports.gi.Gdk;
const Pango = imports.gi.Pango;
const Clutter = imports.gi.Clutter;

const SettingsWidgets = cimports.settings.settingsWidgets;
const Spices = cimports.settings.spices;
const Config = cimports.settings.config;

//const Gettext = Gettext.domain(ExtensionUtils.metadata['gettext-domain']);
const _ = Gettext.gettext;

const home = GLib.get_home_dir();

const SHOW_ALL = 0;
const SHOW_ACTIVE = 1;
const SHOW_INACTIVE = 2;

const SETTING_TYPE_NONE = 0;
const SETTING_TYPE_INTERNAL = 1;
const SETTING_TYPE_EXTERNAL = 2;

const ROW_SIZE = 32;

const SORT_NAME = 0;
const SORT_RATING = 1;
const SORT_DATE_EDITED = 2;
const SORT_ENABLED = 3;
const SORT_REMOVABLE = 4;

const UNSAFE_ITEMS = ["spawn_sync", "spawn_command_line_sync", "GTop", "get_file_contents_utf8_sync"];
const MAX_THREADS = 5;

function versionLeq(a, b) {
    a = a.split('.');
    b = b.split('.');

    if (a.length == 2)
        a.push(0);

    if (b.length == 2)
        b.push(0);

    for (let i = 0; i < 3; i++) {
        if (a[i] == b[i])
            continue;
        else if (a[i] > b[i])
            return false;
        else
            return true;
    }
    return true;
}

function find_extension_subdir(directory) {
    let dir = Gio.file_new_for_path(directory);
    try {
        let fileEnum = dir.enumerate_children('standard::name,standard::type', Gio.FileQueryInfoFlags.NONE, null);

        let info;
        let largest = null;
        while ((info = fileEnum.next_file(null)) != null) {
            let fileType = info.get_file_type();
            if (fileType != Gio.FileType.DIRECTORY)
                continue;

            let subdir = info.get_name();
            if (!subdir.match(/^[0-9]+\.[0-9]+(\.[0-9]+)?$/))
                continue;

            if (versionLeq(subdir, Config.PACKAGE_VERSION) &&
                (!largest || versionLeq(largest[0], name))) {
                largest = [subdir, fileEnum.get_child(info)];
            }
        }

        fileEnum.close(null);
        if (largest)
            return largest[1];
    } catch (e) {
        global.logError("Error looking for extension version for %s in directory %s, %s".format(dir.get_basename(), dir.get_path(), e));
    }
    return dir;
}

const translations = {};

function translate(uuid, string) {
    // check for a translation for this xlet
    if (!(uuid in translations)) {
        try {
            translations[uuid] = gettext.translation(uuid, home + "/.local/share/locale").ugettext;
        } catch(e) {
            try {
                translations[uuid] = gettext.translation(uuid, "/usr/share/locale").ugettext;
            } catch(e2) {
                translations[uuid] = null;
            }
        }
    }
    // do not translate whitespaces
    string = string.trim();
    if (string.length === 0) {
        return string;
    }

    if (translations[uuid]) {
        result = translations[uuid](string);
        if (result != string)
            return result;
    }
    return _(string);
}

const ExtensionSidePage = new GObject.Class({
    Name: 'ClassicGnome.ExtensionSidePage',
    GTypeName: 'ClassicGnomeExtensionSidePage',
    Extends: SettingsWidgets.SidePage,

    _init: function(name, icon, keywords, content_box, collection_type, argv, window, module) {
        this.parent(name, icon, keywords, -2, content_box, false, false, "", argv, window, module);

        this.collection_type = collection_type;
        this.themes = (collection_type == "theme");
        this.icons = [];
        this.background_work_queue = null;
        this.run_once = false;
    },

    load: function() {
        if (!this.isLoaded) {
            SettingsWidgets.SidePage.prototype.load.call(this);
            this.running_uuids = null;
            this._proxy = null;
            this._signals = [];

            let scrolledWindow = new Gtk.ScrolledWindow();
            scrolledWindow.set_shadow_type(Gtk.ShadowType.ETCHED_IN);
            scrolledWindow.set_border_width(6);

            this.stack = new SettingsWidgets.SettingsStack();

            this.stack_switcher = new Gtk.StackSwitcher();
            this.stack_switcher.set_halign(Gtk.Align.CENTER);
            this.stack_switcher.set_stack(this.stack);
            this.stack_switcher.set_homogeneous(true);

            this.vbox = new Gtk.VBox();

            let button_image = new Gtk.Image({
                icon_name: "go-previous-symbolic", icon_size: Gtk.IconSize.BUTTON
            });//id="image1", "can_focus">False</property>
            this.button_back = new Gtk.Button({ image: button_image });//
            this.button_back.get_style_context().add_class("raised");
            this.button_back.get_style_context().add_class("image-button");
            this.button_back.set_tooltip_text(_("Back to all settings"));
            this.button_back.connect('clicked', Lang.bind(this, this._back_to_icon_view));

            let hbox2 = new Gtk.Box();
            hbox2.pack_start(this.button_back, false, false, 0);
            hbox2.pack_start(this.stack_switcher, true, true, 2);

            this.vbox.pack_start(hbox2, false, true, 0);
            this.vbox.pack_start(this.stack, true, true, 2);
            this.vbox.expand = true;
            this.add_widget(this.vbox);

            let extensions_vbox = new Gtk.VBox();

            this.search_entry = new Gtk.Entry();
            this.search_entry.set_icon_from_icon_name(Gtk.EntryIconPosition.PRIMARY, 'edit-find-symbolic');
            this.search_entry.set_placeholder_text(_("Search"));
            this.search_entry.connect('changed', Lang.bind(this, this.on_entry_refilter));

            if (this.collection_type == "applet")
                this.stack.add_titled(extensions_vbox, "installed", _("Installed applets"));
            else if (this.collection_type == "desklet")
                this.stack.add_titled(extensions_vbox, "installed", _("Installed desklets"));
            else if (this.collection_type == "extension")
                this.stack.add_titled(extensions_vbox, "installed", _("Installed extensions"));
            else if (this.collection_type == "theme")
                this.stack.add_titled(extensions_vbox, "installed", _("Installed themes"));

            this.stack.expand = true;

            this.treeview = new Gtk.TreeView();
            this.treeview.set_rules_hint(true);
            this.treeview.set_has_tooltip(true);
            if (this.themes)
                this.treeview.connect("row-activated", Lang.bind(this, this.on_row_activated));

            let cr = new Gtk.CellRendererPixbuf();
            let column2 = new Gtk.TreeViewColumn({ title: "Icon" });
            column2.pack_start (cr, true);
            column2.set_min_width(50);
            column2.add_attribute(cr, "pixbuf", 4);

            cr = new Gtk.CellRendererText();
            let column3 = new Gtk.TreeViewColumn({ title: "Description" });
            column3.pack_start(cr, true);
            column3.add_attribute(cr, "markup", 1);
            column3.set_expand(true);
            if (this.themes) {
                column3.set_max_width(300);
                cr.set_property('wrap-mode', Pango.WrapMode.WORD_CHAR);
                cr.set_property('wrap-width', 200);
            }
            if (this.collection_type == 'applet') {
                cr.set_property('wrap-mode', Pango.WrapMode.WORD_CHAR);
                cr.set_property('wrap-width', 450);
            }

            cr = new Gtk.CellRendererPixbuf();
            cr.set_property("stock-size", Gtk.IconSize.DND);

            this.readOnlyColumn = new Gtk.TreeViewColumn({ title: "Read only" });//icon_name:10
            this.readOnlyColumn.pack_start(cr, true);
            this.readOnlyColumn.add_attribute(cr, "icon_name", 10);
            this.readOnlyColumn.set_expand(true);

            cr = new Gtk.CellRendererPixbuf();
            cr.set_property("stock-size", Gtk.IconSize.DND);

            this.isActiveColumn = new Gtk.TreeViewColumn({ title: "Active" });//icon_name:11
            this.isActiveColumn.pack_start (cr, true);
            this.isActiveColumn.add_attribute(cr, "icon_name", 11);
            this.isActiveColumn.set_expand(true);
            this.isActiveColumn.set_cell_data_func(cr, this._is_active_data_func)

            cr = new Gtk.CellRendererPixbuf();
            cr.set_property("stock-size", Gtk.IconSize.DND)

            this.dangerousColumn = new Gtk.TreeViewColumn({ title: "Dangerous" });
            this.dangerousColumn.pack_start (cr, true);
            this.dangerousColumn.set_expand(true);
            this.dangerousColumn.set_cell_data_func(cr, this._is_dangerous_data_func);

            this.treeview.append_column(column2);
            this.treeview.append_column(column3);
            this.treeview.append_column(this.readOnlyColumn);
            this.treeview.append_column(this.dangerousColumn);
            this.treeview.append_column(this.isActiveColumn);
            this.treeview.set_headers_visible(false);

            this.model = new Gtk.TreeStore();
            this.model.set_column_types([
                GObject.TYPE_STRING, //uuid
                GObject.TYPE_STRING, //desc
                GObject.TYPE_INT, //enabled
                GObject.TYPE_INT, //max-instances
                GdkPixbuf.Pixbuf, //pixbuf
                GObject.TYPE_STRING, //icon
                GObject.TYPE_INT, //name
                GObject.TYPE_BOOLEAN, //read-only
                GObject.TYPE_STRING, //hide-config-button
                GObject.TYPE_LONG, //ext-setting-app
                GObject.TYPE_STRING, //edit-date
                GObject.TYPE_STRING, //read-only
                GObject.TYPE_STRING, //icon
                GObject.TYPE_INT, //active icon
                GObject.TYPE_BOOLEAN, //schema file name (for uninstall)
                GObject.TYPE_BOOLEAN //settings type
                //version_supported, dangerous
            ]);

            this.modelfilter = this.model.filter_new(null);
            this.showFilter = SHOW_ALL;
            this.modelfilter.set_visible_func(Lang.bind(this, this.only_active));

            this.treeview.set_model(this.modelfilter);
            this.treeview.connect("query-tooltip", Lang.bind(this, this.on_treeview_query_tooltip));
            this.treeview.set_search_column(5);
            let tooltip = new Gtk.Tooltip();
            this.treeview.set_tooltip_cell(tooltip, null, this.readOnlyColumn, null);
            this.treeview.set_search_entry(this.search_entry);
            // Find the enabled extensions
            if (!this.themes) {
                this.settings = global.getSettings("org.classic.gnome");
                this.enabled_extensions = this.settings.get_strv("enabled-%ss".format(this.collection_type));
            } else {
                this.settings = global.getSettings("org.classic.gnome.theme");
                this.enabled_extensions = [this.settings.get_string("name")];
            }
            this.load_extensions();

            this.model.set_default_sort_func(Lang.bind(this, this.model_sort_func));
            this.model.set_sort_column_id(-1, Gtk.SortType.ASCENDING);

            if (this.themes) {
                this.settings.connect("changed::enabled-%ss".format(this.collection_type), Lang.bind(this, this._enabled_extensions_changed));
            } else {
               this.settings.connect("changed::name", Lang.bind(this, this._enabled_extensions_changed));
            }
            scrolledWindow.add(this.treeview);
            this.treeview.connect('button_press_event', Lang.bind(this, this.on_button_press_event));

            if (this.collection_type == "applet") {
                this.instanceButton = new Gtk.Button({ label: _("Add to panel") });
                this.removeButton = new Gtk.Button({ label: _("Remove from panel") });
            } else if (this.collection_type == "desklet") {
                this.instanceButton = new Gtk.Button({ label: _("Add to desktop") });
                this.removeButton = new Gtk.Button({ label: _("Remove from desktop") });
            } else if (this.collection_type == "extension") {
                this.instanceButton = new Gtk.Button({ label: _("Add to Cinnamon") });
                this.removeButton = new Gtk.Button({ label: _("Remove from Cinnamon") });
            } else if (this.collection_type == "theme") {
                this.instanceButton = new Gtk.Button({ label: _("Apply theme") });
                this.removeButton = new Gtk.Button({ label: "" }); //Should not be visible for theme
            } else {
                this.instanceButton = new Gtk.Button({ label: _("Add") });
                this.removeButton = new Gtk.Button({ label: _("Remove") });
            }
            this.instanceButton.connect("clicked", Lang.bind(this, this._add_another_instance));
            this.instanceButton.set_sensitive(false);

            this.removeButton.connect("clicked", Lang.bind(this, this._remove_all_instances))
            this.removeButton.set_sensitive(false);

            this.configureButton = new Gtk.Button({ label: _("Configure") });
            this.configureButton.connect("clicked", Lang.bind(this, this._configure_extension));

            this.extConfigureButton = new Gtk.Button({ label: _("Configure") });
            this.extConfigureButton.connect("clicked", Lang.bind(this, this._external_configure_launch));

            let restoreButton;
            if (this.collection_type == "theme")
                restoreButton = new Gtk.Button({ label: _("Restore default theme") });
            else if (this.collection_type == "desklet")
                restoreButton = new Gtk.Button({ label: _("Remove all desklets") });
            else if (this.collection_type == "extension")
                restoreButton = new Gtk.Button({ label: _("Disable all extensions") });
            else
                restoreButton = new Gtk.Button({ label: _("Restore to default") });

            restoreButton.connect("clicked", Lang.bind(this, this._restore_default_extensions));

            let hbox = new Gtk.HBox();
            this.comboshow = new Gtk.ComboBox();
            let renderer_text = new Gtk.CellRendererText();
            this.comboshow.pack_start(renderer_text, true);
            let showTypes = new Gtk.ListStore();
            showTypes.set_column_types ([GObject.TYPE_INT, GObject.TYPE_STRING]);
            showTypes.set(showTypes.append(), [0, 1], [SHOW_ALL, _("All %ss".format(this.collection_type))]);
            showTypes.set(showTypes.append(), [0, 1], [SHOW_ACTIVE, _("Active %ss".format(this.collection_type))]);
            showTypes.set(showTypes.append(), [0, 1], [SHOW_INACTIVE, _("Inactive %ss".format(this.collection_type))]);

            this.comboshow.set_model(showTypes);
            this.comboshow.set_entry_text_column(1);
            this.comboshow.set_active(0); //All
            this.comboshow.connect('changed', Lang.bind(this, this.comboshow_changed));
            this.comboshow.add_attribute(renderer_text, "text", 1);
            this.comboshow.show();

            if (!this.themes) {
                let showLabel = new Gtk.Label();
                showLabel.set_text(_("Show"));
                showLabel.show();
                hbox.pack_start(showLabel, false, false, 4);
                hbox.pack_start(this.comboshow, false, false, 2);
            }
            hbox.pack_end(this.search_entry, false, false, 4);
            extensions_vbox.pack_start(hbox, false, false, 4);
            hbox.set_border_width(3);
            hbox.show();
            this.search_entry.show();

            extensions_vbox.pack_start(scrolledWindow, true, true, 0);
            hbox = new Gtk.HBox();
            extensions_vbox.pack_start(hbox, false, true, 5);

            let buttonbox = new Gtk.ButtonBox({ orientation: Gtk.Orientation.HORIZONTAL });
            buttonbox.set_layout(Gtk.ButtonBoxStyle.START);
            buttonbox.set_spacing(5);
            hbox.pack_start(buttonbox, true, true, 5);
            hbox.xalign = 1.0;

            let img = Gtk.Image.new_from_stock("gtk-add", Gtk.IconSize.BUTTON);
            this.instanceButton.set_image(img);
            img = Gtk.Image.new_from_stock("gtk-remove", Gtk.IconSize.BUTTON);
            this.removeButton.set_image(img);
            img = Gtk.Image.new_from_stock("gtk-properties", Gtk.IconSize.BUTTON);
            this.configureButton.set_image(img);
            img = Gtk.Image.new_from_stock("gtk-properties", Gtk.IconSize.BUTTON);
            this.extConfigureButton.set_image(img);

            buttonbox.pack_start(this.instanceButton, false, false, 0);
            if (this.collection_type != "theme")
                buttonbox.pack_start(this.removeButton, false, false, 0);
            buttonbox.pack_start(this.configureButton, false, false, 0);
            buttonbox.pack_start(this.extConfigureButton, false, false, 0);

            let rightbuttonbox = new Gtk.ButtonBox({ orientation: Gtk.Orientation.HORIZONTAL });
            rightbuttonbox.set_layout(Gtk.ButtonBoxStyle.END);
            rightbuttonbox.pack_start(restoreButton, false, false, 0);

            hbox.pack_end(rightbuttonbox, false, false, 5);

            this.configureButton.hide();
            this.configureButton.set_no_show_all(true);
            this.extConfigureButton.hide();
            this.extConfigureButton.set_no_show_all(true);

            // Get More - Variables prefixed with "gm_" where necessary
            let gm_scrolled_window = new Gtk.ScrolledWindow();
            gm_scrolled_window.set_shadow_type(Gtk.ShadowType.ETCHED_IN);
            gm_scrolled_window.set_border_width(6);
            let getmore_vbox = new Gtk.VBox();
            getmore_vbox.set_border_width(0);

            if (this.collection_type == "applet")
                this.stack.add_titled(getmore_vbox, "more", _("Available applets (online)"));
            else if (this.collection_type == "desklet")
                this.stack.add_titled(getmore_vbox, "more", _("Available desklets (online)"));
            else if (this.collection_type == "extension")
                this.stack.add_titled(getmore_vbox, "more", _("Available extensions (online)"));
            else if (this.collection_type == "theme")
                this.stack.add_titled(getmore_vbox, "more", _("Available themes (online)"));

            this.stack.connect("notify::visible-child-name", Lang.bind(this, this.on_page_changed));

            this.gm_combosort = new Gtk.ComboBox();
            renderer_text = new Gtk.CellRendererText();
            this.gm_combosort.pack_start(renderer_text, true);

            let sortTypes = new Gtk.ListStore();
            sortTypes.set_column_types ([GObject.TYPE_INT, GObject.TYPE_STRING]);
            sortTypes.set(sortTypes.append(), [0, 1], [SORT_NAME, _("Name")]);
            sortTypes.set(sortTypes.append(), [0, 1], [SORT_RATING, _("Popularity")]);
            sortTypes.set(sortTypes.append(), [0, 1], [SORT_DATE_EDITED, _("Date")]);

            this.gm_combosort.set_model(sortTypes);
            this.gm_combosort.set_entry_text_column(1);
            this.gm_combosort.set_active(1); //Rating
            this.gm_combosort.connect('changed', Lang.bind(this, this.gm_changed_sorting));
            this.gm_combosort.add_attribute(renderer_text, "text", 1);
            this.gm_combosort.show();

            hbox = new Gtk.HBox();
            hbox.set_border_width(3);
            let sortLabel = new Gtk.Label();
            sortLabel.set_text(_("Sort by"));
            sortLabel.show();
            hbox.pack_start(sortLabel, false, false, 4);
            hbox.pack_start(this.gm_combosort, false, false, 2);
            hbox.show();

            this.gm_search_entry = new Gtk.Entry();
            this.gm_search_entry.connect('changed', Lang.bind(this, this.gm_on_entry_refilter));
            this.gm_search_entry.set_icon_from_icon_name(Gtk.EntryIconPosition.PRIMARY, 'edit-find');
            this.gm_search_entry.set_placeholder_text(_("Search"));
            hbox.pack_end(this.gm_search_entry, false, false, 4);
            this.search_entry.show();

            getmore_vbox.pack_start(hbox, false, false, 4);

            // MODEL
            this.gm_model = new Gtk.TreeStore();
            this.gm_model.set_column_types([
                GObject.TYPE_STRING, //uuid
                GObject.TYPE_STRING, //name
                GObject.TYPE_INT, //install
                GdkPixbuf.Pixbuf, //icon pixbuf
                GObject.TYPE_INT, //score
                GObject.TYPE_STRING, //name
                GObject.TYPE_INT //date-edited
            ]); 
            this.gm_model.set_sort_column_id(4, Gtk.SortType.DESCENDING);

            // TREE
            this.gm_modelfilter = this.gm_model.filter_new(null);
            this.gm_modelfilter.set_visible_func(Lang.bind(this, this.gm_match_func));
            this.gm_treeview = new Gtk.TreeView();
            this.gm_treeview.set_rules_hint(true);
            this.gm_treeview.set_has_tooltip(true);

            let gm_cr = new Gtk.CellRendererToggle();
            gm_cr.connect("toggled", Lang.bind(this, this.gm_toggled, this.gm_treeview));
            let gm_column1 = new Gtk.TreeViewColumn({ title: "Install" });
            gm_column1.pack_start(gm_cr, true);
            gm_column1.set_cell_data_func(gm_cr, Lang.bind(this, this.gm_celldatafunction_checkbox));

            gm_cr = new Gtk.CellRendererPixbuf();
            let gm_column2 = new Gtk.TreeViewColumn({ title: "Icon" });
            gm_column2.pack_start(gm_cr, true);
            gm_column2.add_attribute(gm_cr, "pixbuf", 3);

            gm_cr = new Gtk.CellRendererText();
            let gm_column3 = new Gtk.TreeViewColumn({ title: "Description" });//markup=1
            gm_column3.pack_start(gm_cr, true);
            gm_column3.add_attribute(gm_cr, "markup", 1);
            gm_column3.set_expand(true);
            if (this.themes) {
                gm_column3.set_max_width(300);
                gm_cr.set_property('wrap-mode', Pango.WrapMode.WORD_CHAR);
                gm_cr.set_property('wrap-width', 200);
            }
            let context = this.gm_treeview.get_style_context();
            if (Gtk.get_minor_version() >= 12)
                this.link_color = context.get_color(Gtk.StateFlags.LINK); // Gtk.StateFlags.LINK was introduced in GTK 3.12.
            else
                this.link_color = context.get_color(Gtk.StateFlags.NORMAL);
            let color = new Clutter.Color({ 
                red: this.link_color.red  * 255, green: this.link_color.green * 255,
                blue: this.link_color.blue * 255, alpha: 255
            });
            this.link_color = color.to_string();
            cr = new Gtk.CellRendererText();
            this.linkColumn = new Gtk.TreeViewColumn({ title: "Action" });
            this.linkColumn.pack_start(cr, true);
            this.linkColumn.set_cell_data_func(cr, Lang.bind(this, this._gm_action_data_func));
            this.linkColumn.set_expand(true);

            cr = new Gtk.CellRendererPixbuf();
            cr.set_property("stock-size", Gtk.IconSize.DND);
            this.statusColumn = new Gtk.TreeViewColumn({ title: "Status" });
            this.statusColumn.pack_start(cr, true);
            this.statusColumn.set_cell_data_func(cr, Lang.bind(this, this._gm_status_data_func));
            this.statusColumn.set_expand(true);

            let right = new Gtk.CellRendererText();
            right.set_property('xalign', 0.5);
            let gm_column4 = new Gtk.TreeViewColumn({ title: "Score" });//right, markup=4
            gm_column4.pack_start(right, true);
            gm_column4.add_attribute(right, "markup", 4);
            gm_column4.set_expand(true);

            this.gm_treeview.append_column(gm_column1);
            this.gm_treeview.append_column(gm_column2);
            this.gm_treeview.append_column(gm_column3);
            this.gm_treeview.append_column(this.linkColumn);
            this.gm_treeview.append_column(this.statusColumn);
            this.gm_treeview.append_column(gm_column4);
            this.gm_treeview.set_headers_visible(false);

            this.gm_treeview.set_model(this.gm_modelfilter);
            this.gm_treeview.set_search_column(5);
            this.gm_treeview.set_search_entry(this.gm_search_entry);

            gm_scrolled_window.add(this.gm_treeview);
            this.gm_treeview.connect('motion_notify_event', Lang.bind(this, this.gm_on_motion_notify_event));
            this.gm_treeview.connect('button_press_event', Lang.bind(this, this.gm_on_button_press_event));
            this.gm_treeview.connect("query-tooltip", Lang.bind(this, this.gm_on_treeview_query_tooltip));

            getmore_vbox.add(gm_scrolled_window);

            hbox = new Gtk.HBox();
            buttonbox = new Gtk.ButtonBox({ orientation: Gtk.Orientation.HORIZONTAL });
            buttonbox.set_spacing(6);
            this.install_button = new Gtk.Button({ label: _("Install or update selected items") });
            let imageNew = new Gtk.Image({ icon_name: "cs-xlet-update", icon_size: Gtk.IconSize.BUTTON });
            this.select_updated = new Gtk.Button({ image: imageNew });
            this.select_updated.set_label(_("Select updated"));

            let reload_button = new Gtk.Button({ label: _("Refresh list") });
            buttonbox.pack_start(this.install_button, false, false, 2);
            buttonbox.pack_start(this.select_updated, false, false, 2);
            buttonbox.pack_end(reload_button, false, false, 2);

            buttonbox.set_child_non_homogeneous(this.install_button, true);
            buttonbox.set_child_non_homogeneous(this.select_updated, true);
            buttonbox.set_child_non_homogeneous(reload_button, true);

            hbox.pack_start(buttonbox, true, true, 5);
            getmore_vbox.pack_end(hbox, false, true, 5);

            reload_button.connect("clicked", Lang.bind(this, function() {
                this.load_spices(true);
            }));
            this.install_button.connect("clicked", Lang.bind(this, this.install_extensions));
            this.select_updated.connect("clicked", Lang.bind(this, this.select_updated_extensions));
            this.select_updated.hide();
            this.select_updated.set_no_show_all(true);
            this.treeview.get_selection().connect("changed", Lang.bind(this, this._selection_changed));
            this.install_list = {};
            this.update_list = {};
            this.current_num_updates = 0;

            this.spices = new Spices.SpiceHarvester(this.collection_type, this.topWindow);

            let extra_page = this.getAdditionalPage();
            if (extra_page)
                this.stack.add_titled(extra_page, "extra", extra_page.label);

            if (!this.themes) {
                this.spices.scrubConfigDirs(this.enabled_extensions);
                this._proxy = global.remoteSettings;
                //this._proxy.connect("g-signal", Lang.bind(this, this._on_signal));
                this._enabled_extensions_changed();
            }
            this.search_entry.grab_focus();
        }
    },

    _back_to_icon_view: function() {
        this.request_navegation("main");
    },

    refresh_running_uuids: function() {
        try {
            if (this._proxy)
                this.running_uuids = this._proxy.getRunningXletUUIDs(this.collection_type);
            else
                this.running_uuids = null;
        } catch(e) {
            this.running_uuids = null;
        }
    },

    /*_on_proxy_ready: function(object, result, data) {
        this._proxy = Gio.DBusProxy.new_for_bus_finish(result);
        this._proxy.connect("g-signal", Lang.bind(this, this._on_signal));
        this._enabled_extensions_changed();
    },*/

    _on_signal: function(proxy, sender_name, signal_name, params) {
        for (let [name, callback] in this._signals) {
            if (signal_name == name)
                callback(params);
        }
    },

    connect_proxy: function(name, callback) {
        this._signals.push([name, callback]);
    },

    disconnect_proxy: function(name) {
        for (let pos in this._signals) {
            if (name == this._signals[pos][0]) {
                this._signals.remove(this._signals[pos]);
                break;
            }
        }
    },

    check_third_arg: function(args) {
        if ((args.length > 2) && (!this.run_once)) {
            let  [ok, iter] = this.model.get_iter_first();
            while (ok) {
                let uuid = this.model.get_value(iter, 0);
                if (uuid == sys.argv[2]) {
                    let path = this.model.get_path(iter);
                    let filtered = this.treeview.get_model().convert_child_path_to_path(path);
                    if (filtered != null) {
                        this.treeview.get_selection().select_path(filtered);
                        this.treeview.scroll_to_cell(filtered, null, false, 0, 0);
                        this.run_once = true;
                        if (this.configureButton.get_visible() && this.configureButton.get_sensitive())
                            this.configureButton.clicked();
                        else if (this.extConfigureButton.get_visible() && this.extConfigureButton.get_sensitive())
                            this.extConfigureButton.clicked();
                    }
                }
                [ok, iter] = this.model.iter_next(iter);
            }
        }
    },

    getAdditionalPage: function() {
        return null;
    },

    on_treeview_query_tooltip: function(treeview, x, y, keyboard_mode, tooltip) {
        let [pathOk, path, column, cell_x, cell_y] = treeview.get_path_at_pos(x, y);
        if (pathOk) {
            let [ok, iter] = this.modelfilter.get_iter(path);
            if(ok) {
                if (column == this.readOnlyColumn) {
                    if (!this.modelfilter.get_value(iter, 6)) {
                        tooltip.set_text(_("Cannot be uninstalled"));
                        return true;
                    }
                    return false;
                } else if (column == this.isActiveColumn) {
                    let count = this.modelfilter.get_value(iter, 2);
                    let markup = "";
                    if (count > 0) {
                        markup += _("In use");
                        if (count > 1)
                            markup += _("\n\nInstance count: %d").format(count);
                        tooltip.set_markup(markup);
                        return true;
                    } else if (count < 0) {
                        markup += _("Problem loading - please check Looking Glass or your system's error log");
                        tooltip.set_markup(markup);
                        return true;
                    }
                } else if (column == this.dangerousColumn) {
                    if (this.modelfilter.get_value(iter, 15)) {   // Dangerous?
                        let msg = _("\"This extension utilizes system calls that could potentially\
                                 cause your desktop to slow down or freeze in some hardware \
                                 configurations. If you experience anything like this, try disabling \
                                 this extension and restarting Cinnamon.\"");
                        tooltip.set_text(msg);
                        return true;
                    }
                     return false;
                }
            }
        }
        return false;
    },

    gm_on_treeview_query_tooltip: function(treeview, x, y, keyboard_mode, tooltip) {
        let [pathOk, path, column, cell_x, cell_y] = treeview.get_path_at_pos(x, y);
        if (pathOk) {
            let [ok, iter] = this.gm_modelfilter.get_iter(path);
            if(ok) {
                if (column == this.statusColumn) {
                    let uuid = this.gm_modelfilter.get_value(iter, 0);
                    let date = this.gm_modelfilter.get_value(iter, 6);
                    let [installed, can_update, is_active] = this.version_compare(uuid, date);
                    if (installed) {
                        if (can_update)
                            tooltip.set_text(_("Update available"));
                        else
                            tooltip.set_text(_("Installed and up-to-date"));
                        return true;
                    }
                } else if (column.get_property('title', "Score") == "Score") {
                    tooltip.set_text(_("Popularity"));
                    return true;
                }
            }
        }
        return false;
    },

    model_sort_func: function(model, iter1, iter2, data) {
        if(model.get_value(iter1, 6) > model.get_value(iter2, 6))
            return false;
        if(model.get_value(iter1, 5) > model.get_value(iter2, 5))
            return true;
        return false;
    },

    on_row_activated: function(treeview, path, column) { // Only used in themes
        let [ok, iter] = this.modelfilter.get_iter(path);
        if(ok) {
            let uuid = this.modelfilter.get_value(iter, 0);
            let name = this.modelfilter.get_value(iter, 5);
            this.enable_extension(uuid, name);
        }
    },

    on_button_press_event: function(widget, event) {
        let [_ok, button] = event.get_button();
        if (button === 3) {
            let [ok, x, y] = event.get_coords();
            let [pathOk, path, column, cell_x, cell_y] = widget.get_path_at_pos(parseInt(x), parseInt(y));
            if (pathOk) {
                let sel = [];
                let item;
                let indices = path.get_indices();
                let [ok, iter] = this.modelfilter.get_iter(path);
                if(ok) {
                    // this.treeview.get_selection().get_selected_rows()[1] returns Gtk.TreeModelFilter, which doeswn't have get_indices.
                    /*for (let i in this.treeview.get_selection().get_selected_rows()[1]) {
                        let _i = this.treeview.get_selection().get_selected_rows()[1][i]
                        global.log(_i)
                        sel.push(_i.get_indices()[0]);
                    }*/
                }
                if (true || sel.length > 0) { // Workaround
                    let popup = new Gtk.Menu();
                    popup.attach_to_widget(this.treeview, null);

                    let uuid = this.modelfilter.get_value(iter, 0);
                    let name = this.modelfilter.get_value(iter, 5);
                    let checked = this.modelfilter.get_value(iter, 2);
                    let version_check = this.modelfilter.get_value(iter, 14);

                    if (this.should_show_config_button(this.modelfilter, iter)) {
                        item = new Gtk.MenuItem({label: _("Configure")});
                        item.connect('activate', Lang.bind(this, this._configure_extension));
                        item.set_sensitive(checked > 0);
                        popup.append(item);
                        popup.append(new Gtk.SeparatorMenuItem());
                    }

                    if (this.should_show_ext_config_button(this.modelfilter, iter)) {
                        item = new Gtk.MenuItem({label: _("Configure")});
                        item.connect('activate', Lang.bind(this, this._external_configure_launch));
                        item.set_sensitive(checked > 0);
                        popup.append(item);
                        popup.append(new Gtk.SeparatorMenuItem());
                    }

                    if (!this.themes) {
                        if (checked != 0) {
                            if (this.collection_type == "applet") {
                                item = new Gtk.MenuItem({label: _("Remove from panel")});
                            } else if (this.collection_type == "desklet") {
                                item = new Gtk.MenuItem({label: _("Remove from desktop")});
                            } else if (this.collection_type == "extension") {
                                item = new Gtk.MenuItem({label: _("Remove from Cinnamon")});
                            } else {
                                item = new Gtk.MenuItem({label: _("Remove")});
                            }
                            item.connect('activate', Lang.bind(this, function(item, uuid, name, checked) {
                                this.disable_extension(uuid, name, checked);
                            }, uuid, name, checked ));
                            popup.append(item);
                        }

                        let max_instances = this.modelfilter.get_value(iter, 3);
                        let can_instance = ((checked != -1) && ((max_instances == -1) || ((max_instances > 0) && (max_instances > checked))));

                        if (can_instance) {
                            if (this.collection_type == "applet") {
                                item = new Gtk.MenuItem({label: _("Add to panel")});
                            } else if (this.collection_type == "desklet") {
                                item = new Gtk.MenuItem({label: _("Add to desktop")});
                            } else if (this.collection_type == "extension") {
                                item = new Gtk.MenuItem({label: _("Add to Cinnamon")});
                            } else {
                                item = new Gtk.MenuItem({label: _("Add")});
                            }
                            item.connect('activate', Lang.bind(this, function(item, uuid, name, checked) {
                                this.enable_extension(uuid, name, version_check);
                            }, uuid, name, checked));
                            popup.append(item);
                        }
                    } else {
                        item = new Gtk.MenuItem({label: _("Apply theme")});
                        item.connect('activate', Lang.bind(this, function(item, uuid, name) {
                            this.enable_extension(uuid, name);
                        }, uuid, name));
                        popup.append(item);
                    }

                    item = new Gtk.MenuItem({label: _("Uninstall")});
                    if (this.modelfilter.get_value(iter, 6)) {
                        let schema_filename = this.modelfilter.get_value(iter, 12);
                        item.connect('activate', Lang.bind(this, function(item, uuid, name, schema_filename) {
                            this.uninstall_extension(uuid, name, schema_filename);
                        }, uuid, name, schema_filename));
                        item.set_sensitive(true);
                    } else {
                        item.set_sensitive(false);
                    }
                    popup.append(item);

                    popup.show_all();
                    popup.popup(null, null, null, null, event.button, event.time);
                }

                // Only allow context menu for currently selected item
                /*if (!(indices[0] in sel)) { // See comment about get_indices above
                    return false;
                }*/
            }
            return true;
        }
        return false;
    },

    _is_active_data_func: function(column, cell, model, iter, data) {
        let enabled = (model.get_value(iter, 2) > 0);
        let error = (model.get_value(iter, 2) < 0);
        let icon = "";
        if (enabled) {
            if (!this.themes)
                icon = "cs-xlet-running";
            else
                icon = "cs-xlet-installed";
        } else if (error) {
            if (this.themes)
                icon = "cs-xlet-error";
        }
        cell.set_property('icon-name', icon);
    },

    _is_dangerous_data_func: function(column, cell, model, iter, data) {
        let dangerous = model.get_value(iter, 15);
        let icon = "";
        if (dangerous)
            icon = "cs-xlet-danger";
        cell.set_property("icon-name", icon);
    },

    comboshow_changed: function(widget) {
        let [ok, tree_iter] = widget.get_active_iter()
        if (ok) {
            let model = widget.get_model();
            let value = model.get_value(tree_iter, 0);
            this.showFilter = value;
            this.modelfilter.refilter();
        }
    },

    version_compare: function(uuid, date) {
        let installed = false;
        let can_update = false;
        let is_active = false;
        let [ok, installed_iter] = this.model.get_iter_first();
        let installed_uuid, installed_date;
        while (ok) {
            installed_uuid = this.model.get_value(installed_iter, 0);
            installed_date = this.model.get_value(installed_iter, 9);
            if (uuid == installed_uuid) {
                installed = true;
                can_update = (date > installed_date);
                is_active = (this.model.get_value(installed_iter, 2) > 0);
                break;
            }
            [ok, installed_iter] = this.model.iter_next(installed_iter);
        }
        return [installed, can_update, is_active];
    },

    gm_view_details: function(uuid) {
        this.spices.showDetail(uuid, Lang.bind(this, function(item, uuid) {
            this.gm_mark(uuid, true);
        }, uuid));
    },

    gm_mark: function(uuid, shouldMark, path) {// shouldMark=true
        let marked = 0;
        let date;
        if (shouldMark)
            marked = 1;
        let  [ok, iter] = this.gm_model.get_iter_from_string(path);
        while (ok) {
            if (uuid == this.gm_model.get_value(iter, 0)) {
                this.gm_model.set_value(iter, 2, marked);
                date = this.gm_model.get_value(iter, 6);
            }
            [ok, iter] = this.gm_model.iter_next(iter);
        }

        if (!shouldMark) {
            let filtered = {};
            for(let cuuid in this.install_list) {
                if(cuuid != uuid) {
                    filtered[cuuid] = this.install_list[cuuid];
                }
            }
            this.install_list = filtered;
        } else {
            if (!(uuid in this.install_list)) {
                let [installed, is_update, is_active] = this.version_compare(uuid, date);
                this.install_list[uuid] = [uuid, is_update, is_active];
            }
        }
        if (Object.keys(this.install_list).length > 0)
            this.install_button.set_sensitive(true);
        else
            this.install_button.set_sensitive(false);

        global.log('this.install_list', JSON.stringify(this.install_list))
    },

    gm_on_motion_notify_event: function(widget, event) {
        let [ok, x, y] = event.get_coords();
        let [pathOk, path, column, cell_x, cell_y] = widget.get_path_at_pos(parseInt(x), parseInt(y));
        if (pathOk) {
            let [ok, iter] = this.gm_modelfilter.get_iter(path);
            this.gm_modelfilter.get_value(iter, 0);
            if (ok && (column == this.linkColumn)) {
                this.topWindow.window.set_cursor(Gdk.Cursor.new(Gdk.CursorType.HAND2));
                return false;
            }
        }
        this.topWindow.window.set_cursor(Gdk.Cursor.new(Gdk.CursorType.ARROW));
        return false;
    },

    gm_on_button_press_event: function(widget, event, data) {
        let [_ok, button] = event.get_button();
        let [ok, x, y] = event.get_coords();
        let [pathOk, path, column, cell_x, cell_y] = widget.get_path_at_pos(parseInt(x), parseInt(y));
        let [ok, button] = event.get_button();
        if ((pathOk) && (button == 1) && (column == this.linkColumn)) {
            let [_ok, iter] = this.gm_modelfilter.get_iter(path);
            let uuid = this.gm_modelfilter.get_value(iter, 0);
            this.gm_view_details(uuid);
            return false;
        }
        if (button == 3) {
            if (pathOk) {
                let sel = [];
                let cy = data;
                let indices = path.get_indices();
                let [ok, iter] = this.gm_modelfilter.get_iter(path);

                /*for (let i in this.gm_treeview.get_selection().get_selected_rows()[1])
                    sel.push(i.get_indices()[0]);*/

                if (true || sel) {
                    let popup = new Gtk.Menu();
                    popup.attach_to_widget(this.treeview, null);
                    let item;
                    let uuid = this.gm_modelfilter.get_value(iter, 0);
                    let name = this.gm_modelfilter.get_value(iter, 5);
                    let date = this.gm_modelfilter.get_value(iter, 6);
                    let marked = this.gm_modelfilter.get_value(iter, 2);
                    let [installed, can_update, is_active] = this.version_compare(uuid, date);
                    let pathStr = path.to_string();
                    if (marked) {
                        item = new Gtk.MenuItem({label: _("Unmark")});
                        popup.append(item);
                        item.connect('activate', Lang.bind(this, function(item, uuid) {
                            this.gm_mark(uuid, false, pathStr);
                        }, uuid));
                    } else {
                        if (!installed || can_update) {
                            if (can_update)
                                item = new Gtk.MenuItem({label: _("Mark for upgrade")});
                            else
                                item = new Gtk.MenuItem({label: _("Mark for installation")});
                            popup.append(item);
                            item.connect('activate', Lang.bind(this, function(item, uuid) {
                                this.gm_mark(uuid, true, pathStr);
                            }, uuid));
                        }
                    }
                    item = new Gtk.MenuItem({label: _("More info")});
                    item.connect('activate', Lang.bind(this, function(item, uuid) {
                        this.gm_view_details(uuid);
                    }, uuid));
                    popup.append(item);

                    //item = new Gtk.MenuItem({label: _("Homepage.."));
                    //item.connect('activate', Lang.bind(this, function(item, uuid) {
                    //    this.gm_launch_homepage(uuid);
                    //}, uuid));
                    //popup.append(item);

                    //item = new Gtk.MenuItem({label: _("Review.."));
                    //item.connect('activate', Lang.bind(this, function(item, uuid) {
                    //    this.gm_view_on_spices(uuid);
                    //}, uuid));
                    //popup.append(item);

                    popup.show_all();
                    popup.popup(null, null, null, null, event.button, event.time);
                }

                // Only allow context menu for currently selected item
                if (!(indices[0] in sel))
                    return false;
            }
            return true;
        }
        return false;
    },

    _gm_action_data_func: function(column, cell, model, iter, data) { // data=null
        cell.set_property('markup',"<span color='%s' underline='single'>%s</span>".format(this.link_color, _("More info")));
    },

    _gm_status_data_func: function(column, cell, model, iter, data) { // data=null
        let installed, can_update, name;
        let uuid = model.get_value(iter, 0);
        let date = model.get_value(iter, 6);
        let [installed, can_update, is_active] = this.version_compare(uuid, date);
        let name;
        if (installed) {
            if (can_update) {
                name = "cs-xlet-update";
                this.update_list[uuid] = true;
            } else {
                name = "cs-xlet-installed";
                if (uuid in this.update_list)
                    delete this.update_list[uuid];
            }
        } else {
            name = "";
            if (uuid in this.update_list)
                delete this.update_list[uuid];
        }
        cell.set_property("icon-name", name);
        this.refresh_update_button();
    },

    gm_toggled: function(renderer, path, treeview) {
        let active = !renderer.get_active();
        let [ok, iter] = this.gm_modelfilter.get_iter_from_string(path);
        if (ok) {
            let uuid = this.gm_modelfilter.get_value(iter, 0);
            this.gm_mark(uuid, active, path);
            /*let checked = this.gm_modelfilter.get_value(iter, 2);
            if (checked == true)
                this.gm_mark(uuid, false);
            else
                this.gm_mark(uuid, true);*/
        }
    },

    gm_celldatafunction_checkbox: function(column, cell, model, iter, data) {
        let uuid = model.get_value(iter, 0);
        let date = model.get_value(iter, 6);
        let checked = model.get_value(iter, 2);
        let [installed, can_update, is_active] = this.version_compare(uuid, date);
        cell.set_property("activatable", (!installed) || can_update);
        if (checked > 0)
            cell.set_property("active", true);
        else
            cell.set_property("active", false);
    },

    only_active: function(model, iter, data) {
        let query = this.search_entry.get_buffer().get_text().toLowerCase();
        let extensionName = model.get_value(iter, 5);
        let enabled = model.get_value(iter, 2);
        if (extensionName == null)
            return false;
        let math = ((query.length == 0) || (extensionName.toLowerCase().indexOf(query.toLowerCase()) != -1))

        if (this.showFilter == SHOW_ALL)
            return math;
        else if (this.showFilter == SHOW_ACTIVE)
            return (math && (enabled > 0));
        else if (this.showFilter == SHOW_INACTIVE)
            return (math && (enabled <= 0));
        return false;
    },

    on_entry_refilter: function(widget, data) {
        this.modelfilter.refilter();
    },

    gm_changed_sorting: function(widget) {
        let [ok, tree_iter] = widget.get_active_iter();
        if (ok) {
            let model = widget.get_model();
            let value = model.get_value(tree_iter, 0);
            if (value === SORT_NAME)
                this.gm_model.set_sort_column_id(5, Gtk.SortType.ASCENDING);
            else if (value === SORT_RATING)
                this.gm_model.set_sort_column_id(4, Gtk.SortType.DESCENDING);
            else if (value === SORT_DATE_EDITED)
                this.gm_model.set_sort_column_id(6, Gtk.SortType.DESCENDING);
        }
    },

    gm_match_func: function(model, iter, data) {
        let query = this.gm_search_entry.get_buffer().get_text();
        let value = model.get_value(iter, 5);
        return ((query.length == 0) || (value.toLowerCase().indexOf(query.toLowerCase()) != -1))
    },

    gm_on_entry_refilter: function(widget, data) {
        this.gm_modelfilter.refilter();
    },

    load_spices: function(force) {
        force = (force === true);
        this.update_list = {};
        this.spices.load(Lang.bind(this, this.on_spice_load), force);
    },

    install_extensions: function() {
        if (Object.keys(this.install_list).length > 0) {
            this.spices.installAll(this.install_list, Lang.bind(this, this.install_finished));
        }
    },

    install_finished: function(need_restart) {
        let  [ok, iter] = this.gm_model.get_iter_first();
        while (ok) {
            this.gm_model.set_value(iter, 2, 0);
            [ok, iter] = this.gm_model.iter_next(iter);
        }
        this.install_button.set_sensitive(false);
        this.install_list = {};
        this.load_extensions();
        //FIXME: This will need to be the last log, and it's not. we are not waiting for finished.
        global.log("called, finisheddddddddddddddddddddddddddddddddddddddddddddddd");
        /*for (uuid in need_restart) {
            this.requestedEnabled.push(uuid);
            this.connect_proxy("xlet-added-complete", Lang.bind(this, this.xlet_added_callback));
            this._proxy.reloadXlet(uuid, this.collection_type.toUpperCase());
        }*/
    },

    on_spice_load: function(spicesData) {
        //global.log("total spices loaded: %d".format(Object.keys(spicesData).length));
        let extensionData, extensionName, iter, iconFilename,
            w, h, cacheIcon, theme, img, surface, wrapper;

        this.gm_model.clear();
        this.install_button.set_sensitive(false);
        for (let uuid in spicesData) {
            extensionData = spicesData[uuid];
            extensionName = extensionData['name'].replace('&', '&amp;');
            if (!this.themes) {
                iconFilename = Gio.file_new_for_path(extensionData['icon']).get_basename();
                w = ROW_SIZE + 5;
                h = ROW_SIZE + 5;
            } else {
                iconFilename = Gio.file_new_for_path(extensionData['screenshot']).get_basename();
                w = -1;
                h = 60;
            }
            cacheIcon = this.spices.getCacheFolder().get_child(this.collection_type).get_child(iconFilename);
            if (!cacheIcon.query_exists(null)) {
                theme = Gtk.IconTheme.get_default();
                if (theme.has_icon("cs-%ss".format(this.collection_type)))
                    img = theme.load_icon("cs-%ss".format(this.collection_type), h, 0);
            } else {
                try {
                    img = GdkPixbuf.Pixbuf.new_from_file_at_size(cacheIcon.get_path(), w, h);
                } catch(e) {
                    theme = Gtk.IconTheme.get_default();
                    if (theme.has_icon("cs-%ss".format(this.collection_type)))
                        img = theme.load_icon("cs-%ss".format(this.collection_type), h, 0);
                }
            }
            iter = this.gm_model.insert_before(null, null);
            this.gm_model.set_value(iter, 0, uuid);
            this.gm_model.set_value(iter, 1, "<b>%s</b>".format(extensionName));
            this.gm_model.set_value(iter, 2, 0);
            this.gm_model.set_value(iter, 3, img);
            this.gm_model.set_value(iter, 4, parseInt(extensionData['score']));
            this.gm_model.set_value(iter, 5, extensionData['name']);
            this.gm_model.set_value(iter, 6, parseInt(extensionData['last_edited']));
        }
    },

    enable_extension: function(uuid, name, version_check) { //version_check = true
        if (!version_check) {
            let msg = _("Extension %s is not compatible with current version of cinnamon. \
                        Using it may break your system. Load anyway?").format(uuid);
            if (!this.show_prompt(msg))
                return;
            else
                uuid = "!" + uuid;
        }
        if (!this.themes) {
            let extension_id = 0;
            if (["applet", "desklet"].indexOf(this.collection_type) != -1) {
                extension_id = this.settings.get_int("next-%s-id".format(this.collection_type));
                this.settings.set_int("next-%s-id".format(this.collection_type), (extension_id + 1));
            }
            this.enabled_extensions.push(this.toSettingString(uuid, extension_id));
            if (this._proxy)
                this.connect_proxy("xlet-added-complete", Lang.bind(this, this.xlet_added_callback));
            this.settings.set_strv("enabled-%ss".format(this.collection_type), this.enabled_extensions);
            this.load_extensions();
        } else {
            if (uuid == "STOCK")
                this.settings.set_string("name", "");
            else
                this.settings.set_string("name", name);
        }
    },

    xlet_added_callback: function(success, uuid) {
        if (!success) {
            this.disable_extension(uuid, "", 0);

            msg = _("\"There was a problem loading the selected item, and it has been disabled.\n\n \
                    Check your system log and the Cinnamon LookingGlass log for any issues.\
                    Please contact the developer.\"");

            dialog = new Gtk.MessageDialog({
                transient_for: this.topWindow,
                modal: true,
                message_type: Gtk.MessageType.ERROR
            });
            esc = cgi.escape(msg);
            dialog.set_markup(esc);

            if (this.do_logs_exist())
                dialog.add_button(_("View logfile(s)"), 1);

            dialog.add_button(_("Close"), 2);
            dialog.set_default_response(2);

            dialog.connect("response", Lang.bind(this, this.on_xlet_error_dialog_response));

            dialog.show_all();
            response = dialog.run();
        }
        this.disconnect_proxy("xlet-added-complete");

        GObject.timeout_add(100, this._enabled_extensions_changed);
    },

    on_xlet_error_dialog_response: function(widget, id) {
        if (id == 1)
            this.show_logs();
        else if (id == 2)
            widget.destroy();
    },

    disable_extension: function(uuid, name, checked) {// checked=0
        if (checked > 1) {
            msg = _("There are multiple instances, do you want to remove all of them?\n\n");
            msg += this.RemoveString;

            if (!this.show_prompt(msg))
                return;
        }
        if (!this.themes) {
            let newExtensions = [];
            for (var i = 0; i < this.enabled_extensions.length; i++) {
                if (this.enabled_extensions[i].indexOf(uuid) === -1) {
                    newExtensions.push(this.enabled_extensions[i])
                }
            }
            this.enabled_extensions = newExtensions;
            this.settings.set_strv("enabled-%ss".format(this.collection_type), this.enabled_extensions);
            this.load_extensions();
        } else {
            if (this.enabled_extensions[0] == name)
                this._restore_default_extensions();
        }
    },

    uninstall_extension: function(uuid, name, schema_filename) {
        let obj;
        if (!this.themes)
            obj = uuid;
        else
            obj = name;
        let msg = _("Are you sure you want to completely remove %s?").format(obj);
        if (!(this.show_prompt(msg)))
            return;
        this.disable_extension(uuid, name, 0);

        this.spices.uninstall(uuid, name, schema_filename, Lang.bind(this, this.on_uninstall_finished));
    },

    on_uninstall_finished: function(uuid) {
        this.load_extensions();
    },

    on_page_changed: function(stack) {
        let name = stack.get_visible_child_name();
        if ((name == "more") && (this.gm_model.iter_n_children(null) == 0))
            this.load_spices();
        this.focus(name);
    },

    focus: function(name) {
        if (name == "installed")
            this.search_entry.grab_focus();
        else
            this.gm_search_entry.grab_focus();
        return false;
    },

    _enabled_extensions_changed: function() {
        let last_selection = '';
        let [ok, model, treeiter] = this.treeview.get_selection().get_selected();
        this.refresh_running_uuids();

        if (this.themes)
            this.enabled_extensions = [this.settings.get_string("name")];
        else
            this.enabled_extensions = this.settings.get_strv("enabled-%ss".format(this.collection_type));

        let uuidCount = {};
        for (let enabled_extension in this.enabled_extensions) {
            try {
                let uuid = this.fromSettingString(enabled_extension).lstrip("!");
                if (uuid == "")
                    uuid = "STOCK";
                if (uuid in uuidCount)
                    uuidCount[uuid] += 1;
                else
                    uuidCount[uuid] = 1;
            } catch(e) {
                continue;
            }
        }
        if(ok) {
            let  [okIter, iter] = this.model.get_iter_first();
            while (okIter) {
                if (!this.themes) {
                    uuid = this.model.get_value(iter, 0);
                } else {
                    if (this.model.get_value(iter, 0) == "STOCK")
                        uuid = "STOCK";
                    else
                        uuid = this.model.get_value(iter, 5);
                }
                if (uuid in uuidCount) {
                    if (this.running_uuids != null) {
                        if (uuid in this.running_uuids)
                            this.model.set_value(iter, 2, uuidCount[uuid]);
                        else
                            this.model.set_value(iter, 2, -1);
                    } else {
                        this.model.set_value(iter, 2, uuidCount[uuid]);
                    }
                } else {
                    this.model.set_value(iter, 2, 0);
                }
                [okIter, iter] = this.model.iter_next(iter);
            }
        }
        this._selection_changed();
    },

    fromSettingString: function(string) {
        return string;
    },

    _add_another_instance: function() {
        let [ok, model, treeiter] = this.treeview.get_selection().get_selected();
        if (ok)
            this._add_another_instance_iter(treeiter);
    },

    _remove_all_instances: function() {
        let [ok, model, treeiter] = this.treeview.get_selection().get_selected();

        if (ok) {
            let uuid = model.get_value(treeiter, 0);
            let checked = model.get_value(treeiter, 2);
            let name = model.get_value(treeiter, 5);

            this.disable_extension(uuid, name, checked);
        }
    },

    select_updated_extensions: function() {
        let msg;
        if (this.update_list.length > 1)
            msg = _("This operation will update the selected items.\n\nDo you want to continue?");
        else
            msg = _("This operation will update the selected item.\n\nDo you want to continue?");
        if (!this.show_prompt(msg))
            return;
        let  [ok, iter] = this.gm_model.get_iter_first();
        while (ok) {
            let uuid = this.gm_model.get_value(iter, 0);
            if (uuid in this.update_list)
                this.gm_mark(uuid, true);
            [ok, iter] = this.gm_model.iter_next(iter);
        }
        this.install_extensions();
    },

    refresh_update_button: function() {
        let num = this.update_list.length;
        if (num == this.current_num_updates)
            return;
        this.current_num_updates = num;
        if (num > 0) {
            if (num > 1)
                this.select_updated.set_label(_("%d updates available!").format(this.update_list.length));
            else
                this.select_updated.set_label(_("%d update available!").format(this.update_list.length));
            this.select_updated.show();
        } else {
            this.select_updated.hide();
        }
    },

    _add_another_instance_iter: function(treeiter) {
        let uuid = this.modelfilter.get_value(treeiter, 0);
        let name = this.modelfilter.get_value(treeiter, 5);
        let version_check = this.modelfilter.get_value(treeiter, 14);
        this.enable_extension(uuid, name, version_check);
    },

    _selection_changed: function() {
        let [ok, model, treeiter] = this.treeview.get_selection().get_selected();
        if (ok) {
            let checked = model.get_value(treeiter, 2);
            let max_instances = model.get_value(treeiter, 3);
            let enabled = ((checked != -1) && ((max_instances == -1) || ((max_instances > 0) && (max_instances > checked))));

            this.instanceButton.set_sensitive(enabled);

            this.removeButton.set_sensitive(checked > 0);

            this.configureButton.set_visible(this.should_show_config_button(model, treeiter));
            this.configureButton.set_sensitive(checked > 0);
            this.extConfigureButton.set_visible(this.should_show_ext_config_button(model, treeiter));
            this.extConfigureButton.set_sensitive(checked > 0);
        }
    },

    should_show_config_button: function(model, iter) {
        let hide_override = model.get_value(iter, 7);
        let setting_type = model.get_value(iter, 13);
        return ((setting_type == SETTING_TYPE_INTERNAL) && (!hide_override));
    },

    should_show_ext_config_button: function(model, iter) {
        let hide_override = model.get_value(iter, 7);
        let setting_type = model.get_value(iter, 13);
        return ((setting_type == SETTING_TYPE_EXTERNAL) && (!hide_override));
    },

    _configure_extension: function(widget) { //widget = null
        let [ok, model, treeiter] = this.treeview.get_selection().get_selected();
        if (ok) {
            let uuid = model.get_value(treeiter, 0);
            this.spices.spawnCommand(global.rootdatadir + '/tools/xlet-settings.js settings applet ' + uuid);
        }
    },

    _external_configure_launch: function(widget) { // widget = null
        let [ok, model, treeiter] = this.treeview.get_selection().get_selected();
        if (treeiter) {
            let app = model.get_value(treeiter, 8);
            if (app != null)
                this.spices.spawnCommand(app);
        }
    },

    _close_configure: function(settingContainer) {
        settingContainer.content.hide();
        this.stack.show_all();
        //this._on_signal(null, null, "show_stack", ());
    },

    _restore_default_extensions: function() {
        if (!this.themes) {
            let msg = "";
            if (this.collection_type == "applet")
                msg = _("This will restore the default set of enabled applets. Are you sure you want to do this?");
            else if (this.collection_type == "desklet")
                msg = _("This will restore the default set of enabled desklets. Are you sure you want to do this?");
            else if (this.collection_type == "extension")
                msg = _("This will disable all active extensions. Are you sure you want to do this?");
            if (this.show_prompt(msg)) {
                if (this.collection_type != "extension")
                    this.settings.reset("next-%s-id".format(this.collection_type));
                this.settings.reset("enabled-%ss".format(this.collection_type));
            }
        } else {
            this.settings.reset("name");
        }
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

    uuid_already_in_list: function(uuid) {
        let found = false;
        let col = 0;
        if (this.themes)
            col = 5;
        let installed_uuid;
        let  [ok, installed_iter] = this.model.get_iter_first();
        while (ok) {
            installed_uuid = this.model.get_value(installed_iter, col);
            if (uuid == installed_uuid) {
                found = true;
                break;
            }
            [ok, installed_iter] = this.model.iter_next(installed_iter);
        }
        return found;
    },

    load_extensions: function() {
        this.model.clear();
        if (!this.themes) {
            this.load_extensions_in(GLib.build_filenamev([global.userclassicdatadir, this.collection_type + "s"]));
            this.load_extensions_in(GLib.build_filenamev([global.rootdatadir, this.collection_type + "s"]));
        } else {
            this.load_extensions_in("%s/.themes".format(home));
            this.load_extensions_in("/usr/share", true);
            this.load_extensions_in("/usr/share/themes");
        }
    },

    load_extensions_in: function(directory, stock_theme) { // stock_theme = false
        let info, writeable, extensions, extension, extension_dir,
            extension_max_instances, extension_role, extension_name,
            extension_uuid, extension_description, extension_icon, ext_config_app,
            hide_config_button, setting_type, last_edited, schema_filename,
            dangerous, iconWriteable, iconFound, metadataDir, json_data, data, ok, version_supported,
            iter, found, img, size, text, wrapper, surface,
            themeGtk, themes, themeDir, theme_last_edited, theme_uuid, theme_name,
            theme_description, iconPath, extension_key;

        let dir = Gio.file_new_for_path(directory);
        if (!(dir.query_exists(null) && (dir.query_file_type(Gio.FileQueryInfoFlags.NONE, null) == Gio.FileType.DIRECTORY)))
            return;

        info = dir.query_info("access::can-write", Gio.FileQueryInfoFlags.NONE, null);
        writeable = info.get_attribute_boolean("access::can-write");

        if (!this.themes) { // Applet, Desklet, Extension handling
            extensions = this._listdir(dir).sort();
            for (let pos in extensions) {
                extension = extensions[pos];

                if (this.uuid_already_in_list(extension))
                    continue;
                extension_dir = dir.get_child(extension);
                try {
                    metadataDir = extension_dir.get_child("metadata.json");
                    if (!(metadataDir.query_exists(null)))
                        continue;
                    setting_type = 0;
                    [ok, json_data] = GLib.file_get_contents(metadataDir.get_path());
                    data = JSON.parse(json_data);
                    extension_uuid = data["uuid"];
                    extension_name = translate(data["uuid"], data["name"]);
                    extension_description = translate(data["uuid"], data["description"]);

                    if ((!data["max-instances"]) || (data["max-instances"] == undefined))
                        extension_max_instances = 1;
                    else
                        extension_max_instances = parseInt(data["max-instances"]);

                    extension_role = data["role"];
                    if(!extension_role || (extension_role === undefined))
                       extension_role = null;

                    hide_config_button = data["hide-configuration"];
                    if(!hide_config_button || (hide_config_button === undefined))
                        hide_config_button = false;

                    if (data["multiversion"] && (data["multiversion"] !== undefined))
                        extension_dir = find_extension_subdir(extension_dir.get_path());

                    if ((!data["external-configuration-app"]) ||
                        (data["external-configuration-app"] == undefined)) {
                        ext_config_app = "";
                    } else {
                        ext_config_app = GLib.build_filenamev([
                            extension_dir.get_path(),
                            data["external-configuration-app"]
                        ]);
                        setting_type = SETTING_TYPE_EXTERNAL;
                    }

                    if (extension_dir.get_child("settings-schema.json").query_exists(null))
                        setting_type = SETTING_TYPE_INTERNAL;

                    last_edited = data["last-edited"];
                    if(!last_edited || (last_edited === undefined))
                        last_edited = -1;

                    schema_filename = data["schema-file"];
                    if(!schema_filename || (schema_filename === undefined))
                        schema_filename = "";

                    dangerous = false;
                    if (writeable) {
                        dangerous = data["dangerous"];
                        if(!dangerous || (dangerous === undefined)) {
                            this.scan_extension_for_danger(extension_dir.get_path());
                            dangerous = false;
                        }
                    }
                    if(!data["cinnamon-version"] || (data["cinnamon-version"] === undefined)) {
                        version_supported = true; // Don't check version if not specified.
                    } else {
                        version_supported = (
                            (Config.PACKAGE_VERSION in data["cinnamon-version"]) ||
                            (Config.PACKAGE_VERSION.split(".")[Config.PACKAGE_VERSION.length - 1] in data["cinnamon-version"])
                        );
                    }
                    if (!Gio.file_new_for_path(ext_config_app).query_exists(null))
                        ext_config_app = "";

                    if (extension_max_instances < -1)
                        extension_max_instances = 1;

                    extension_key = (extension_name + extension_description).toUpperCase();
                    if (extension_key.indexOf(this.search_entry.get_text().toUpperCase()) == -1)
                        continue;
                    found = (this.enabled_extensions.toString().indexOf(extension_uuid) !== -1);
                    text = "<b>%s</b>\n<i><span size='small'>%s</span></i>".format(extension_name, extension_description);
                    img = null;
                    size = ROW_SIZE;
                    if ("icon" in data) {
                        extension_icon = data["icon"];
                        themeGtk = Gtk.IconTheme.get_default();
                        if (themeGtk.has_icon(extension_icon))
                            img = themeGtk.load_icon(extension_icon, size, 0);
                    } else if (extension_dir.get_child("icon.png").query_exists(null)) {
                        try {
                            img = GdkPixbuf.Pixbuf.new_from_file_at_size(extension_dir.get_child("icon.png").get_path(), size, size);
                        } catch(e) {
                            img = null;
                        }
                    }
                    if (img == null) {
                        themeGtk = Gtk.IconTheme.get_default()
                        if (themeGtk.has_icon("cs-%ss".format(this.collection_type)))
                            img = themeGtk.load_icon("cs-%ss".format(this.collection_type), size, 0);
                    }
                    if (writeable)
                        iconWriteable = "";
                    else
                        iconWriteable = "cs-xlet-system";
                    if (found) {
                        iconFound = "cs-xlet-running";
                    } else {
                        iconFound = "";
                    }
                    iter = this.model.insert_before(null, null);
                    this.model.set_value(iter, 0, extension_uuid);
                    this.model.set_value(iter, 1, text);
                    this.model.set_value(iter, 2, found);
                    this.model.set_value(iter, 3, extension_max_instances);
                    this.model.set_value(iter, 4, img);
                    this.model.set_value(iter, 5, extension_name);
                    this.model.set_value(iter, 6, writeable);
                    this.model.set_value(iter, 7, hide_config_button);
                    this.model.set_value(iter, 8, ext_config_app);
                    this.model.set_value(iter, 9, parseFloat(last_edited));
                    this.model.set_value(iter, 10, iconWriteable);
                    this.model.set_value(iter, 11, iconFound);
                    this.model.set_value(iter, 12, schema_filename);
                    this.model.set_value(iter, 13, setting_type);
                    this.model.set_value(iter, 14, version_supported);
                    this.model.set_value(iter, 15, dangerous);
                } catch(eg) {
                    global.logError("Failed to load extension %s: %s".format(extension, eg));
                }
            }
        } else { // Theme handling
            if (stock_theme)
                themes = ["cinnamon"];
            else
                themes = this._listdir(dir).sort();
            for (let theme in themes) {
                if (this.uuid_already_in_list(theme))
                    continue;
                try {
                    if (stock_theme)
                        themeDir = dir.get_child(theme).get_child("theme");
                    else
                        themeDir = dir.get_child(theme).get_child("cinnamon");
                    if (!(themeDir.query_exists(null) && (
                        themeDir.query_file_type(Gio.FileQueryInfoFlags.NONE, null) ==
                        Gio.FileType.DIRECTORY)))
                        continue;
                    theme_last_edited = -1;
                    theme_uuid = "";
                    metadataDir = themeDir.get_child("metadata.json");
                    if (metadataDir.query_exists(null)) {
                        [ok, json_data] = GLib.file_get_contents(metadataDir.get_path());
                        data = JSON.parse(json_data);
                        theme_last_edited = data["last-edited"];
                        if(!theme_last_edited || (theme_last_edited === undefined))
                            theme_last_edited = -1;
                        theme_uuid = data["uuid"];
                        if(!theme_uuid || (theme_uuid === undefined))
                            theme_uuid = "";
                    }
                    if (stock_theme) {
                        theme_name = "Cinnamon";
                        theme_uuid = "STOCK";
                    } else {
                        theme_name = theme;
                    }
                    theme_description = "";
                    found = 0;
                    for (let enabled_theme in this.enabled_extensions) {
                        if (enabled_theme == theme_name)
                            found = 1;
                        else if ((enabled_theme == "") && (theme_uuid == "STOCK"))
                            found = 1;
                    }
                    if (metadataDir.get_child("thumbnail.png").query_exists(null))
                        iconPath = metadataDir.get_child("thumbnail.png").get_path();
                    else
                        iconPath = "/usr/share/cinnamon/theme/thumbnail-generic.png";
                    size = 60;
                    img = GdkPixbuf.Pixbuf.new_from_file_at_size(iconPath, -1, size);
                    if (writeable)
                        iconWriteable = "";
                    else
                        iconWriteable = "cs-xlet-system";
                    if (found)
                        iconFound = "cs-xlet-installed";
                    else
                        iconFound = "";
                    iter = this.model.insert_before(null, null);
                    this.model.set_value(iter, 0, theme_uuid);
                    this.model.set_value(iter, 1, "<b>%s</b>".format(theme_name));
                    this.model.set_value(iter, 2, found);
                    this.model.set_value(iter, 3, 1);
                    this.model.set_value(iter, 4, img);
                    this.model.set_value(iter, 5, theme_name);
                    this.model.set_value(iter, 6, writeable);
                    this.model.set_value(iter, 7, true);
                    this.model.set_value(iter, 8, "");
                    this.model.set_value(iter, 9, long(theme_last_edited));
                    this.model.set_value(iter, 10, iconWriteable);
                    this.model.set_value(iter, 11, iconFound);
                    this.model.set_value(iter, 13, SETTING_TYPE_NONE);
                    this.model.set_value(iter, 14, true);
                } catch(ge) {
                    global.logError("Failed to load extension %s: %s".format(theme, ge));
                }
            }
        }
    },

    show_prompt: function(msg) {
        let dialog = new Gtk.MessageDialog({
            transient_for: this.topWindow,
            destroy_with_parent: true,
            message_type: Gtk.MessageType.QUESTION,
            buttons: Gtk.ButtonsType.YES_NO
        });
        dialog.set_default_size(400, 200);
        //esc = cgi.escape(msg);
        dialog.set_markup(msg);
        dialog.show_all();
        let response = dialog.run();
        dialog.destroy();
        return (response == Gtk.ResponseType.YES);
    },

    show_info: function(msg) {
        dialog = new Gtk.MessageDialog({
            transient_for: this.topWindow,
            modal: true,
            message_type: Gtk.MessageType.INFO,
            buttons: Gtk.ButtonsType.OK
        });
        esc = cgi.escape(msg);
        dialog.set_markup(esc);
        dialog.show_all();
        response = dialog.run();
        dialog.destroy();
    },

////////////////////////////////// LOG FILE OPENING SPECIFICS

// Other distros can add appropriate instructions to these two methods
// to open the correct locations

    do_logs_exist: function() {
        return (Gio.file_new_for_path(home).get_child(Config.USER_DOMAIN_FOLDER).get_child("glass.log").query_exists(null) ||
                Gio.file_new_for_path(home).get_child(".xsession-errors").query_exists(null));
    },

    show_logs: function() {
        let glassLog = Gio.file_new_for_path(home).get_child(Config.USER_DOMAIN_FOLDER).get_child("glass.log");
        let xerrorLog = Gio.file_new_for_path(home).get_child(".xsession-errors");
        if (glassLog.query_exists(null)) {
            try {
                let [success, argv] = GLib.shell_parse_argv("xdg-open '%s'".format(glassLog.get_path()));
                if(success) {
                    GLib.spawn_async(null, argv, null,
                                     GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.STDOUT_TO_DEV_NULL  | GLib.SpawnFlags.STDERR_TO_DEV_NULL,
                                     null, null);
                }
            } catch (e) {}
        }
        if (xerrorLog.query_exists(null)) {
            try {
                let [success, argv] = GLib.shell_parse_argv("xdg-open '%s'".format(xerrorLog.get_path()));
                if(success) {
                    GLib.spawn_async(null, argv, null,
                                     GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.STDOUT_TO_DEV_NULL  | GLib.SpawnFlags.STDERR_TO_DEV_NULL,
                                     null, null);
                }
            } catch (e) {}
        }
    },

////////////////////////////////// Xlet scanning for dangerous elements

    scan_extension_for_danger: function(directory) {
        /*if (!this.background_work_queue) {
            this.background_work_queue = new BGWorkQueue();
            this.background_work_queue.connect("finished", Lang.bind(this, this.on_bg_work_complete));
        }
        this.background_work_queue.push(this.scan_extension_thread, directory);*/
    },

    on_bg_work_complete: function(queue) {
        this.load_extensions();
    },

    scan_extension_thread: function(directory) {
        dangerous = false;
        let dir = Gio.file_new_for_path(directory);

        try {
            this._scan_dir(dir);
        } catch(e) {
            dangerous = true;
        }

        let jsonFile = dir.get_child("metadata.json");

        // This may be a versioned extension, check the parent folder
        if (!jsonFile.query_exists(null))
            jsonFile = dir.get_parent().get_child("metadata.json");

        raw_meta = GLib.file_get_contents(jsonFile.get_path());
        md = JSON.parse(raw_meta);
        md["dangerous"] = dangerous;
        GLib.file_set_contents(jsonFile.get_path(), md);
    },

    _scan_item: function(item) {
        if (item.get_path().endsWith(".js")) {
            contents = GLib.file_get_contents(item.get_path());
            for (let unsafe_item in UNSAFE_ITEMS) {
                if (unsafe_item in contents)
                    throw Exception("unsafe");
            }
        }
    },

    _scan_dir: function(subdir) {
        let list = this._listdir(subdir);
        for (let pos in list) {
            itemfile = subdir.get_child(list[pos]);
            if (itemfile.query_file_type(Gio.FileQueryInfoFlags.NONE, null) ==
                        Gio.FileType.DIRECTORY)
                this._scan_dir(itemfile);
            else
                this._scan_item(itemfile);
        }
    },
});
/*
const BGWorkQueue = new GObject.Class({
    Name: 'ClassicGnome.BGWorkQueue',
    GTypeName: 'ClassicGnomeBGWorkQueue',
    Signals: {
        'finished': {
            flags: GObject.SignalFlags.RUN_LAST,
            param_types: []
        },
    },

    _init: function() {
        this.jobs = [];
        this.thread_ids = [];
        this.lock = thread.allocate_lock();
        this.idle_id = 0;
        this.start_id = 0;
    },

    push: function(func, data) {
        if (this.start_id > 0) {
            GObject.source_remove(this.start_id);
            this.start_id = 0;
        }
        this.jobs.insert(0, (func, data));

        this.start_id = GObject.idle_add(this.check_start_job);
    },

    check_start_job: function() {
        this.start_id = 0;
        if (this.jobs.length > 0) {
            if (this.thread_ids.length == MAX_THREADS)
                return false;

            job = this.jobs.pop();
            handle = thread.start_new_thread(this.thread_function_wrapper, job);
            this.thread_ids.push(handle);
            this.check_start_job();
            return true;
        }
        return false;
    },

    thread_function_wrapper: function(func, data) {
        func(data);

        this.on_thread_complete();
        thread.exit();
    },

    on_thread_complete: function() {
        tid = thread.get_ident();

        this.lock.acquire();
        this.prune_thread(tid);

        if (this.thread_ids.length == 0)
            this.send_idle_complete();

        this.lock.release();
    },

    prune_thread: function(tid) {
        try {
            this.thread_ids.remove(tid);
        } catch(e) {}
        this.check_start_job();
    },

    _idle_complete_cb: function() {
        this.idle_id = 0;

        this.emit("finished");

        return false;
    },

    send_idle_complete: function() {
        if (this.idle_id > 0) {
            GObject.source_remove(this.idle_id);
            this.idle_id = 0;
        }
        this.idle_id = GObject.idle_add(this._idle_complete_cb);
    },
});*/
