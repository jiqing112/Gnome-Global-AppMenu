// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Clutter = imports.gi.Clutter;
const St = imports.gi.St;

const Main = imports.ui.main;
const Params = imports.misc.params;

// Gnome Shell have not St.Table, was removed.
// This an attempt to implement the St.Table using Clutter.TableLayout.
const Table = new Lang.Class({
    Name: 'Table-Global',
    Extends: St.Widget,

    _init: function(params) {
        this._homogeneous = false;
        if(params && (params !== undefined)) {
            if("homogeneous" in params) {
                this._homogeneous = params["homogeneous"];
                delete params["homogeneous"];
            }
            if("important" in params) {
                this._important = params["important"];
                delete params["important"];
            }
        }
        this.parent(params);
        this.actor = this;
        this.actor.add = Lang.bind(this, function(actor, params) {
            params = Params.parse(params, {
                x_align: St.Align.MIDDLE, y_align: St.Align.MIDDLE,
                x_fill: true, y_fill: true,
                x_expand: false, y_expand: false,
                row: 0, col: 0,
                row_span: 1, col_span: 1
            });
            let layout = this.actor.layout_manager;
            layout.pack(actor, params.col, params.row);
            layout.set_span(actor, params.col_span, params.row_span);
            layout.set_alignment(actor, params.x_align, params.y_align);
            layout.set_fill(actor, params.x_fill, params.y_fill);
            layout.set_expand(actor, params.x_expand, params.y_expand);
        });
        this.actor.layout_manager = new Clutter.TableLayout();
    },
});

function init() {
    St.TextDirection = Clutter.TextDirection;
    patchImportant();
    patchStIcon();
    patchStTable();
    patchStTextureCache();
    patchStScrollView();
    patchBoxLayout();
}

function patchStTable() {
    if(!St.Table) {
        St.Table = Table;
    }
}

function patchStScrollView() {
    St.ScrollView._real_init = St.ScrollView.prototype._init;
    St.ScrollView.prototype._init = function(params) {
        this._important = false;
        if(params && (params !== undefined)) {
            if("important" in params) {
                this._important = params["important"];
                delete params["important"];
            }
        }
        St.ScrollView._real_init.call(this, params);
    };
    if (!St.ScrollView.prototype.set_auto_scrolling) {
        St.ScrollView.prototype._doScrolling = function() {
            if(this._timeOutScroll) {
                Mainloop.source_remove(this._timeOutScroll);
                this._timeOutScroll = null;
                if(this._actorScrolling && this.auto_scrolling &&
                   this._auto_scrolling_id || (this._auto_scrolling_id !== undefined)) {
                    let dMin = 20;
                    let dMax = 100;
                    let speed = 10;
                    let hScroll = this._actorScrolling.get_hscroll_bar();
                    let vScroll = this._actorScrolling.get_vscroll_bar();
                    let hAdjustment = hScroll.get_adjustment();
                    let vAdjustment = vScroll.get_adjustment();
                    let [mx, my, mask] = global.get_pointer();
                    let [ax, ay] = this._actorScrolling.get_transformed_position();
                    let [aw, ah] = [this._actorScrolling.get_width(), this._actorScrolling.get_height()];
                    if((vAdjustment.upper > vAdjustment.page_size) && (mx < ax + aw) && (mx > ax)) {
                        if((my < ay + dMin) && (my > ay - dMax)) {
                            if(ay > my)
                                speed = speed*(ay - my);
                            let val = vAdjustment.get_value();
                            vAdjustment.set_value(val - speed);
                            this._timeOutScroll = Mainloop.timeout_add(100, Lang.bind(this, this._doScrolling));
                        } else if((my > ay + ah - dMin)&&(my < ay + ah + dMax)) {
                            if(ay + ah < my)
                                speed = speed*(my - ay - ah);
                            let val = vAdjustment.get_value();
                            vAdjustment.set_value(val + speed);
                            this._timeOutScroll = Mainloop.timeout_add(100, Lang.bind(this, this._doScrolling));
                        }
                    } else if ((hAdjustment.upper > hAdjustment.page_size) && (my < ay + ah) && (my > ay)) {
                        if((mx < ax + dMin) && (mx > ax - dMax)) {
                            if(ax > mx)
                                speed = speed*(ax - mx);
                            let val = hAdjustment.get_value();
                            hAdjustment.set_value(val - speed);
                            this._timeOutScroll = Mainloop.timeout_add(100, Lang.bind(this, this._doScrolling));
                        } else if((mx > ax + aw - dMin)&&(mx < ax + aw + dMax)) {
                            if(ax + aw < mx)
                                speed = speed*(mx - ax - aw);
                            let val = hAdjustment.get_value();
                            hAdjustment.set_value(val + speed);
                            this._timeOutScroll = Mainloop.timeout_add(100, Lang.bind(this, this._doScrolling));
                        }
                    }
                }
            }
        };
        St.ScrollView.prototype._onMotionEvent = function(actor, event) {
            let hScroll = this.get_hscroll_bar();
            let vScroll = this.get_vscroll_bar();
            let hAdjustment = hScroll.get_adjustment();
            let vAdjustment = vScroll.get_adjustment();
            this._timeOutScroll = null;
            if(!this._timeOutScroll && (vAdjustment.upper > vAdjustment.page_size)) {
                this._actorScrolling = actor;
                let dMin = 20;
                let dMax = 100;
                let [mx, my] = event.get_coords();
                let [ax, ay] = this._actorScrolling.get_transformed_position();
                let [aw, ah] = [this._actorScrolling.get_width(), this._actorScrolling.get_height()];
                if((mx < ax + aw)&&(mx > ax)&&((my < ay + dMin)&&(my > ay - dMax))||
                   ((my > ay + ah - dMin)&&(my < ay + ah + dMax))) {
                    this._timeOutScroll = Mainloop.timeout_add(100, Lang.bind(this, this._doScrolling));
                }
            } else if(!this._timeOutScroll && (hAdjustment.upper > hAdjustment.page_size)) {
                this._actorScrolling = actor;
                let dMin = 20;
                let dMax = 100;
                let [mx, my] = event.get_coords();
                let [ax, ay] = this._actorScrolling.get_transformed_position();
                let [aw, ah] = [this._actorScrolling.get_width(), this._actorScrolling.get_height()];
                if((my < ay + ah)&&(my > ay)&&((mx < ax + dMin)&&(mx > ax - dMax))||
                   ((mx > ax + aw - dMin)&&(mx < ax + aw + dMax))) {
                    this._timeOutScroll = Mainloop.timeout_add(100, Lang.bind(this, this._doScrolling));
                }
            }
        };
        St.ScrollView.prototype.set_auto_scrolling = function(auto_scrolling) {
          try {
            if (this.auto_scrolling != auto_scrolling) {
                this.auto_scrolling = auto_scrolling;
                if (this.auto_scrolling && (!this._auto_scrolling_id || (this._auto_scrolling_id === undefined))) {
                    this._auto_scrolling_id = this.connect('motion-event', Lang.bind(this, this._onMotionEvent));
                } else if(!this.auto_scrolling && (this._auto_scrolling_id || (this._auto_scrolling_id !== undefined))) {
                    this.disconnect(this._auto_scrolling_id);
                    this._auto_scrolling_id = null;
                }
            }
          } catch(e) {
             Main.notify("Err" + e);
          }
        }
    };
}

function patchStTextureCache() {
    St.TextureCache.real_load_gicon = St.TextureCache.prototype.load_gicon;
    St.TextureCache.prototype.load_gicon = function(theme_node, icon, size, scale) {
        if(!scale)
           scale = 1;
        return St.TextureCache.real_load_gicon.call(this, theme_node, icon, size, scale);
    };

    // https://developer.gnome.org/st/stable/st-st-texture-cache.html#st-texture-cache-load-file-to-cairo-surface
    St.TextureCache.real_load_file_to_cairo_surface = St.TextureCache.prototype.load_file_to_cairo_surface;
    St.TextureCache.prototype.load_file_to_cairo_surface = function(file, scale) {
        if (scale === undefined || !scale) {
            scale = global.ui_scale;
        }
        if (typeof file === 'string') {
            file = Gio.File.new_for_path(file);
        }
        try {
            return St.TextureCache.real_load_file_to_cairo_surface.call(this, file, scale);
        } catch (e) {
             global.logError('load_file_to_cairo_surface: ', e); 
        }
        return null;
    };
}
//FIXME: We need to set symbolic icons when name are set
function patchStIcon() {
    if(!St.IconType) {
       St.IconType = { SYMBOLIC:0, FULLCOLOR:1 };
       St.Icon.prototype.icon_type = St.IconType.FULLCOLOR;
       St.Icon._real_init = St.Icon.prototype._init;
       St.Icon.prototype._init = function(params) {
          this._important = false;
          this._icon_type = null;
          if(params && (params !== undefined)) {
              if("icon_type" in params) {
                  this._icon_type = params["icon_type"];
                  delete params["icon_type"];
              }
              if("important" in params) {
                this._important = params["important"];
                delete params["important"];
              }
          }
          St.Icon._real_init.call(this, params);
          if((this._icon_type == 0) && this.icon_name &&
              ((this.icon_name.length < 10) ||
              (this.icon_name.substr(this.icon_name.length - 9) != "-symbolic"))) {
              this.icon_name = this.icon_name + "-symbolic";
          }
       };
       Object.defineProperty(St.Icon.prototype, "icon_type", {
           get: function() {
               return this._icon_type;
           },
           set: function(icon_type) {
               this._icon_type = icon_type;
               if((this._icon_type == 0) && this.icon_name &&
                  ((this.icon_name.length < 10) ||
                  (this.icon_name.substr(this.icon_name.length - 9) != "-symbolic"))) {
                   this.icon_name = this.icon_name + "-symbolic";
               }
           }
       });
       St.Icon.prototype.set_icon_type = function(icon_type) {
          this._icon_type = icon_type;
          if((this._icon_type == 0) && this.icon_name &&
              ((this.icon_name.length < 10) ||
              (this.icon_name.substr(this.icon_name.length - 9) != "-symbolic"))) {
              this.icon_name = this.icon_name + "-symbolic";
          }
       };
       St.Icon.prototype.get_icon_type = function() {
          return this._icon_type;
       };
    }
}
function patchImportant() {
    // Base on: https://github.com/linuxmint/Cinnamon/commit/3b02e585ab8503f405d79cb1c12f5fe0cd4bc81f
    St.Widget._real_init = St.Widget.prototype._init;
    St.Widget.prototype._init = function(params) {
        this._important = false;
        if(params && (params !== undefined)) {
            if("important" in params) {
                this._important = params["important"];
                delete params["important"];
            }
        }
        St.Widget._real_init.call(this, params);
    };
    St.Bin._real_init = St.Bin.prototype._init;
    St.Bin.prototype._init = function(params) {
        this._important = false;
        if(params && (params !== undefined)) {
            if("important" in params) {
                this._important = params["important"];
                delete params["important"];
            }
        }
        St.Bin._real_init.call(this, params);
    };
}

function patchBoxLayout() {
    // Base on: https://github.com/linuxmint/Cinnamon/commit/803cd0f9229ea0549bf08e33f2ec745c62b6b51a
    St.BoxLayout._real_init = St.BoxLayout.prototype._init;
    St.BoxLayout.prototype._init = function(params) {
        this._important = false;
        this._align_end = false;
        if(params && (params !== undefined)) {
            if("important" in params) {
                this._important = params["important"];
                delete params["important"];
            }
            if("align_end" in params) {
                this._align_end = params["align_end"];
                delete params["align_end"];
            }
        }
        St.BoxLayout._real_init.call(this, params);
    };
    // Base on: https://github.com/GNOME/gnome-shell/commit/a8b081661cfcb1b65a6a9fe9bf2f96e27d6d2c20
    if (!St.BoxLayout.prototype.insert_actor) {
        St.BoxLayout.prototype.insert_actor = function(actor, index) {
            this.insert_child_at_index(actor, index);
        };
    }
    if (!St.BoxLayout.prototype.insert_before) {
        St.BoxLayout.prototype.insert_before = function(actor, before_actor) {
            this.insert_child_below(actor, before_actor);
        };
    }
    // Base on: https://github.com/GNOME/gnome-shell/commit/c892610f277ca9f918b9bd099225419fcc347fd8
    if (!St.BoxLayout.prototype.destroy_children) {
        St.BoxLayout.prototype.destroy_children = function() {
            this.destroy_all_children();
        };
    }
}
