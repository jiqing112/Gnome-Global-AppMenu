// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Signals = imports.signals;
const Clutter = imports.gi.Clutter;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const Meta = imports.gi.Meta;
const Gio = imports.gi.Gio;

function init() {
    // Add some bindings to the global JS namespace; (gjs keeps the web
    // browser convention of having that namespace be called 'window'.)
    // This will add support for signalHandlerIsConnected in Signals module:
    // https://github.com/linuxmint/cjs/commit/9db778fefaf77098d0958d1e2c9c7905f91b8341
    if (!Signals._signalHandlerIsConnected) {
        Signals._signalHandlerIsConnected = function(id) {
            if (! '_signalConnections' in this)
                return false;

            for (let connection of this._signalConnections) {
                if (connection.id == id) {
                    if (connection.disconnected)
                        return false;
                    else
                        return true;
                }
            }
            return false;
        };
        Signals._real_addSignalMethods = Signals.addSignalMethods;
        Signals.addSignalMethods = function(proto) {
            Signals._real_addSignalMethods(proto);
            proto.signalHandlerIsConnected = Signals._signalHandlerIsConnected;
        };
    }

    if (!global.logWarning) {
        global.logWarning = function(message) {
            global.log(message);
        };
    }

    const ExtensionUtils = imports.misc.extensionUtils;
    const CurrentExtension = ExtensionUtils.getCurrentExtension();

    const Shell = imports.gi.Shell;
    const Main = imports.ui.main;
    const MD5 = CurrentExtension.imports.settings.md5;
    const StPatches = CurrentExtension.imports.stPatches;
    Gtk.IconTheme.get_default().append_search_path(CurrentExtension.dir.get_child("icons").get_path());

    global._stage_input_mode = {
        NONREACTIVE : 0,
        NORMAL : 1,
        FOCUSED : 2,
        FULLSCREEN : 3,
    };

    if(!global.set_stage_input_mode) {//FIXME: How simulate this?
        Object.defineProperty(global, "stage_input_mode", {
            get: function() {
                return global._stage_input_mode;
            },
            set: function(input_mode) {
                global._stage_input_mode = input_mode;
            }
        });
        global.set_stage_input_mode = function(input_mode) {
            global.stage_input_mode = input_mode;
        };
    }

    if(!global.ui_scale) {
        //FIXME: use the scale factor of the St.ThemeContext as ui_scale it's ok?
        let scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        global.ui_scale = scale;
    }

    if(!global.get_md5_for_string) {
        global.get_md5_for_string = function(string) {
            return MD5.md5(string);
        };
    }
    if(!global.set_cursor) {
        global.set_cursor = function(cursor) {
            global.screen.set_cursor(cursor);
        };
        global.unset_cursor = function() {
            global.screen.set_cursor(Meta.Cursor.DEFAULT);
        };
    }

    Clutter.Actor.prototype.get_direction = function() {
        return this.get_text_direction();
    };
    Clutter.Actor.prototype.change_style_pseudo_class = function(pseudo_class, added) {
        if(added)
           this.add_style_pseudo_class(pseudo_class);
        else
           this.remove_style_pseudo_class(pseudo_class);
    };

    StPatches.init();
}

function finalized() {
}
