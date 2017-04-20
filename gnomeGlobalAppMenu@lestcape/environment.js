// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

imports.gi.versions.Clutter = '1.0';
imports.gi.versions.Gio = '2.0';
imports.gi.versions.Gdk = '3.0';
imports.gi.versions.GdkPixbuf = '2.0';
imports.gi.versions.Gtk = '3.0';

const Signals = imports.signals;
const Gettext = imports.gettext;
const Clutter = imports.gi.Clutter;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const St = imports.gi.St;
const Meta = imports.gi.Meta;
const Gio = imports.gi.Gio;

// We can't import cinnamon JS modules yet, because they may have
// variable initializations, etc, that depend on init() already having
// been run.


// "monkey patch" in some varargs ClutterContainer methods; we need
// to do this per-container class since there is no representation
// of interfaces in Javascript
function _patchContainerClass(containerClass) {
    // This one is a straightforward mapping of the C method
    containerClass.prototype.child_set = function(actor, props) {
        let meta = this.get_child_meta(actor);
        for (let prop in props)
            meta[prop] = props[prop];
    };

    // clutter_container_add() actually is a an add-many-actors
    // method. We conveniently, but somewhat dubiously, take the
    // this opportunity to make it do something more useful.
    containerClass.prototype.add = function(actor, props) {
        this.add_actor(actor);
        if (props)
            this.child_set(actor, props);
    };
}

function getCurrentFile() {
    let path = null;
    try {
        let stack = (new Error()).stack;
        let stackLine = stack.split('\n')[1];
        if (!stackLine)
            throw new Error('Could not find current file');
        let match = new RegExp('@(.+):\\d+').exec(stackLine);
        if (!match)
            throw new Error('Could not find current file');
        path = match[1];
    } catch(e) {
        global.logError("Unlocalized requiered librarys");
        return null;
    }
    return Gio.File.new_for_path(path);
}

function spawnApp(argv) {
    try {
        let app = Gio.AppInfo.create_from_commandline(argv.join(' '), null,
                                                      Gio.AppInfoCreateFlags.SUPPORTS_STARTUP_NOTIFICATION);

        let context = new Gio.AppLaunchContext();
        app.launch([], context, false);
    } catch(err) {
        global.log(err.message);
    }
}

function patchEnviromentLaunch() {
    // Add our path at the begin of the PATH enviroment variable.
    // This allow to see our tools first than the cinnamon tools in the gnome session.
    let runningPath = GLib.getenv('PATH');
    let toolsPath = GLib.build_filenamev([global.rootdatadir, "tools"]);
    if(runningPath) {
        global.log("runningPath: " + runningPath);
        let listPath = runningPath.split(":");
        let newRunningPath = "";
        for(let pos in listPath) {
            if((listPath[pos].indexOf(toolsPath) == -1) || (toolsPath.indexOf(listPath[pos]) == -1)) {
                newRunningPath += ":" + listPath[pos];
            }
        }
        newRunningPath = toolsPath + newRunningPath;
        GLib.setenv('PATH', newRunningPath, true);
        //Ok - Now set execution permisions to all our files.
        try {
            let perm = parseInt(755, 8);
            let dir = Gio.file_new_for_path(toolsPath);
            let fileEnum = dir.enumerate_children('standard::name,standard::type',
                                                  Gio.FileQueryInfoFlags.NONE, null);
            if (fileEnum != null) {
                let info, infoX, file;
                while ((info = fileEnum.next_file(null))) {
                    if(info.get_file_type() == Gio.FileType.REGULAR) {
                        file = dir.get_child(info.get_name());
                        infoX = file.query_info("unix::mode", Gio.FileQueryInfoFlags.NONE, null);
                        infoX.set_attribute_uint32("unix::mode", perm);
                        file.set_attributes_from_info(infoX, Gio.FileQueryInfoFlags.NONE, null);
                    }
                }
                //spawnApp(["classic-gnome-daemon.js", "&"]);
                return true;
            }
        } catch (e) {
            return false;
        }
    }
    return false;
}

function init() {
    // Add some bindings to the global JS namespace; (gjs keeps the web
    // browser convention of having that namespace be called 'window'.)
/*    window.global = Cinnamon.Global.get();

    window._ = Gettext.gettext;
    window.C_ = Gettext.pgettext;
    window.ngettext = Gettext.ngettext;

    // Set the default direction for St widgets (this needs to be done before any use of St)
    if (Gtk.Widget.get_default_direction() == Gtk.TextDirection.RTL) {
        St.Widget.set_default_direction(St.TextDirection.RTL);
    }

    // Miscellaneous monkeypatching
    //_patchContainerClass(St.BoxLayout);
    //_patchContainerClass(St.Table);

    Clutter.Actor.prototype.toString = function() {
        return St.describe_actor(this);
    };*/

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
/*
    global.loadCinnamon = function() {
        var BaseLibary;
        try {
           BaseLibary = imports.gi.Cinnamon;  // Cinnamon C libraries using GObject Introspection
        } catch(e) {
           BaseLibary = imports.gi.Shell; // Gnome-Shell C libraries using GObject Introspection
        }
        const Cinnamon = BaseLibary;
        if(Cinnamon.Cursor === undefined || !Cinnamon.Cursor) {
            Cinnamon.Cursor = Meta.Cursor;
        }
        if(Cinnamon.StageInputMode === undefined || !Cinnamon.StageInputMode) {
            Cinnamon.StageInputMode = {
                NONREACTIVE : 0,
                NORMAL : 1,
                FOCUSED : 2,
                FULLSCREEN : 3,
            };
        }
        if(!Cinnamon.WindowTracker.prototype.is_window_interesting) {
            Cinnamon.WindowTracker.prototype.is_window_interesting = function(metaWindow) {
                return !metaWindow.skip_taskbar;
            };
        }
        if(!Cinnamon.get_event_state) {
            Cinnamon.get_event_state = function(event) {
                return event.get_state();
            };
        }

        if(!Cinnamon.WindowTracker.prototype.is_window_interesting) {
            Cinnamon.WindowTracker.prototype.is_window_interesting = function(metaWindow) {
                return !metaWindow.skip_taskbar;
            };
        }
        if (Cinnamon.Slicer === undefined || !Cinnamon.Slicer) {
            Cinnamon.Slicer = St.Bin;
        }
        if(!Cinnamon.AppSystem.prototype.get_tree) {
            Cinnamon.AppSystem.prototype.get_tree = function() {
                let tree = new imports.gi.GMenu.Tree({ menu_basename: "applications.menu" });
                tree.load_sync();
                return tree;
            };
            if(!Cinnamon.AppSystem.prototype.lookup_app_by_tree_entry) {
                Cinnamon.AppSystem.prototype.lookup_app_by_tree_entry = function(entry) {
                    let appSystem = Cinnamon.AppSystem.get_default();
                    return appSystem.lookup_app(entry.get_desktop_file_id());
                };
            }
        }
        if(!Cinnamon.App.prototype.get_keywords) {
            Cinnamon.App.prototype.get_keywords = function() {
                let keywords = this.get_app_info().get_keywords();
                let result = "";
                if(keywords)
                    result = keywords.join(",");
                return result;
            };
        }
        if(!Cinnamon.util_get_label_for_uri) {
            Cinnamon.util_get_label_for_uri = function(uri) {
                try {
                    if(uri) {
                        let file = Gio.file_new_for_uri(uri);
                        let fileInfo = file.query_info("standard::name", Gio.FileQueryInfoFlags.NONE, null);
                        return fileInfo.get_name();
                    }
                    return _("Unknown");
                } catch(e) {
                    //imports.ui.main.notify(" " + uri);
                    return _("Network");//Network Connections
                }
            };
        }
        if(!Cinnamon.util_get_icon_for_uri) {
            Cinnamon.util_get_icon_for_uri = function(uri) {
                if(uri) {
                    let file = Gio.file_new_for_uri(uri);
                    let [contentType, uncertain] = Gio.content_type_guess(file.get_path(), null);
                    let icon = Gio.content_type_get_icon(contentType);
                    //let fileInfo = file.query_info("standard::icon", Gio.FileQueryInfoFlags.NONE, null);
                    //return fileInfo.get_icon();
                    if(icon)
                        return icon;
                    return Gio.new_for_string("network-workgroup");
                }
                return Gio.new_for_string("image-missing");
            };
        }
        if (!Cinnamon.TrayManager.redisplay) {
            Cinnamon.TrayManager.redisplay = function() {
                return false;
            }
        }
        return Cinnamon;
    };
*/
    global.loadMeta = function() {
        if (Meta.WindowTileType === undefined || !Meta.WindowTileType) {
            Meta.WindowTileType = {NONE: 0, TILED: 1, SNAPPED: 2};
        }
        return Meta;
    };

    const ExtensionUtils = imports.misc.extensionUtils.getCurrentExtension();
    window.cimports = ExtensionUtils.imports;

    const Shell = imports.gi.Shell;
    const Main = imports.ui.main;
    ///const Overrides = imports.ui.overrides;
    ///const Format = imports.misc.format;
    ///const Tweener = imports.ui.tweener;
    //const Convenience = imports.convenience;
    const MD5 = ExtensionUtils.imports.settings.md5;
    const StPatches = ExtensionUtils.imports.stPatches;

    //const Cinnamon = imports.gi.Shell;
    //const SignalManager = ExtensionUtils.imports.signalManager;
    const Config = imports.misc.config;

    //global.cinnamon_settings = Convenience.getSettings("org.classic.gnome");

    if(!Main.isInteresting) {
        Main.isInteresting = function() {
            return true;
        };
    }
    let rootFile = getCurrentFile().get_parent().get_parent();
    global.rootdatadir = rootFile.get_path();
    global.rootUUID = rootFile.get_basename();
    //global.userclassicdatadir = GLib.build_filenamev([GLib.get_user_data_dir(), Config.USER_INSTALL_FOLDER]);
    global._stage_input_mode = {
        NONREACTIVE : 0,
        NORMAL : 1,
        FOCUSED : 2,
        FULLSCREEN : 3,
    };
    //global.cinnamonSignalManager = new SignalManager.SignalManager(this);
    // TBD
    global.patchMetaWindowActor = function (metaWindowActor) {
        //let connectFunc = metaWindowActor.connect;
        metaWindowActor.connect = function(sigName, callback) {
            return
            /*if (sigName === 'size-changed') {
                sigName = 'size-change';
                global.cinnamonSignalManager.connect(global.window_manager, sigName, callback)
                global.sizeChangeSignals = {};
                global.sizeChangeSignals[metaWindowActor] = sigName;
                return
            } else {
                connectFunc(sigName, callback);
            }*/
        }
        //let disconnectFunc = metaWindowActor.disconnect;
        metaWindowActor.disconnect = function (signal) {
            return
            /*if (global.sizeChangeSignals[metaWindowActor] !== undefined) {
                global.cinnamonSignalManager.disconnect(global.sizeChangeSignals[metaWindowActor], global.window_manager)
            } else {
                disconnectFunc(signal)
            }*/
        }
        return metaWindowActor;
    };

    if(!global.display.add_custom_keybinding) {
        global.display.add_custom_keybinding = function(name, bindings, handler) {
            if(!global.display._custom_keybindings)
                global.display._custom_keybindings = {};
            global.display._custom_keybindings[name] = [];
            let modes = Shell.ActionMode.ALL;
            for (let pos in bindings) {
                let action = global.display.grab_accelerator(bindings[pos]);
                global.display._custom_keybindings[name].push(action);
                if (action != Meta.KeyBindingAction.NONE) {
                    Main.wm.allowKeybinding(Meta.external_binding_name_for_action(action), modes);
                    global.display.connect('accelerator-activated', function (display, actionPreformed, deviceid, timestamp) {
                        if (actionPreformed == action) {
                            let kb = null; //FIXME: What it's this a keyboard map, the active keyboard state?
                            let event = Clutter.get_current_event(); // This is the current keyboard event-
                            handler(display, global.screen, event, kb, actionPreformed);
                        }
                    });
                }
            }
            return true;
        };

        global.display.remove_custom_keybinding = function(name) {
            if(global.display._custom_keybindings && (name in global.display._custom_keybindings)) {
                let actions = global.display._custom_keybindings[name];
                for(let pos in actions) {
                    if(actions[pos] != Meta.KeyBindingAction.NONE) {
                        global.display.ungrab_accelerator(actions[pos]);
                    }
                }
                delete global.display._custom_keybindings[name];
            }
        };

        // Do nothing, just not crash
        global.display.rebuild_keybindings = function() {
            //let ungrabSucceeded = global.display.ungrab_accelerator(action);
        };
    }

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
    if(!global.reparentActor) {
        global.reparentActor = Main._reparentActor;
    }

    if(!global.get_md5_for_string) {
        global.get_md5_for_string = function(string) {
            return MD5.md5(string);
        };
    }
    if(!global.create_pointer_barrier) {
        global.create_pointer_barrier = function(x1, y1, x2, y2, directions) {
            return new Meta.Barrier({
                display: global.display,
                x1: x1, y1: y1,
                x2: x2, y2: y2,
                directions: directions
            });
        };
    }
    if(!global.destroy_pointer_barrier) {
        global.destroy_pointer_barrier = function(barrier) {
            barrier.destroy();
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
    if(!global.screen.toggle_desktop) {
        global.screen.is_open_desktop = true;
        global.screen.toggle_desktop = function(time) {
            let shellwm = global.window_manager;
            if(global.screen.is_open_desktop) {
                let activeWorkspace = global.screen.get_active_workspace();
                let windows = activeWorkspace.list_windows();
                for (let i = 0; i < windows.length; i++) {
                    if (!windows[i].minimized && !windows[i].skip_taskbar)
	                windows[i].minimize();
                }
            } else {
                let activeWorkspace = global.screen.get_active_workspace();
                let windows = activeWorkspace.list_windows();
                for (let i = 0; i < windows.length; i++) {
                    if (windows[i].minimized && !windows[i].skip_taskbar)
	                windows[i].unminimize();
                }
            }
            global.screen.is_open_desktop = !global.screen.is_open_desktop;
        };
    }
    // Not a complete implementation of get_mouse_window. Will need to find out how to compare cursor position.
    // https://people.gnome.org/~tthurman/docs/metacity/screen_8c-source.html#l01440
    if (!global.screen.get_mouse_window) {
        global.screen.get_mouse_window = function(metaWindow) {
            let activeWorkspace = global.screen.get_active_workspace();
            let windows = activeWorkspace.list_windows();

            let windowsFiltered = windows.filter(function(win) {
                return win.has_focus()
            });

            if (windowsFiltered.length > 0) {
                return windowsFiltered[0];
            } else {
                return windows[0];
            }
        }
    }
    if(!global.display.list_windows) {
        global.display.list_windows = function() {
            return global.get_window_actors();
            //let screen = global.screen;
            //let display = screen.get_display();
            //return display.get_tab_list(Meta.TabList.DOCKS, screen.get_active_workspace ());
        };
    }

    // Patch create_app_launch_context, Gnome version expects two arguments.
    // https://developer.gnome.org/shell/stable/shell-shell-global.html#shell-global-create-app-launch-context
    if(global.create_app_launch_context) {
        // We don't want to lost the original:
        global.__create_app_launch_context = global.create_app_launch_context;
        //Override the behavior:
        global.create_app_launch_context = function(timestamp, workspaceIndex) {
            if (timestamp === undefined || !timestamp) {
                timestamp = global.get_current_time();
            }
            if (workspaceIndex === undefined || !workspaceIndex) {
                workspaceIndex = -1;
            }
            // Call the real one:
            return global.__create_app_launch_context(timestamp, workspaceIndex);
        };
    }

    if (!global.overlay_group) {
        global.overlay_group = new Clutter.Actor()
    }

    Gtk.IconTheme.get_default().append_search_path(GLib.build_filenamev([global.rootdatadir, "icons"]));

    Clutter.Actor.prototype.get_direction = function() {
        return this.get_text_direction();
    };
    Clutter.Actor.prototype.change_style_pseudo_class = function(pseudo_class, added) {
        if(added)
           this.add_style_pseudo_class(pseudo_class);
        else
           this.remove_style_pseudo_class(pseudo_class);
    };
    Clutter.Actor.prototype.set_important = function() {
        // TBD
        return false;
    }
    /*
    let origToString = Object.prototype.toString;
    Object.prototype.toString = function() {
        let base = origToString.call(this);
        if ('actor' in this && this.actor instanceof Clutter.Actor)
            return base.replace(/\]$/, ' delegate for ' + this.actor.toString().substring(1));
        else
            return base;
    };

    // Work around https://bugzilla.mozilla.org/show_bug.cgi?id=508783
    Date.prototype.toLocaleFormat = function(format) {
        return Cinnamon.util_format_date(format, this.getTime());
    };

    let slowdownEnv = GLib.getenv('CINNAMON_SLOWDOWN_FACTOR');
    if (slowdownEnv) {
        let factor = parseFloat(slowdownEnv);
        if (!isNaN(factor) && factor > 0.0)
            St.set_slow_down_factor(factor);
    }

    // OK, now things are initialized enough that we can import cinnamon JS

    Tweener.init();
    String.prototype.format = Format.format;*/
    patchEnviromentLaunch();

    StPatches.init();
    ///Overrides.init();
}
