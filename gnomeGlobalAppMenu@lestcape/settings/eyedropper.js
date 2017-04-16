const Gettext = imports.gettext;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Gdk = imports.gi.Gdk;
const GdkPixbuf = imports.gi.GdkPixbuf;

//from PIL import Image
function pixbuf2Image(pb) {
    let size = [pb.get_width(), pb.get_height()];
    return Image.fromstring("RGB", size, pb.get_pixels());
}

const EyeDropper = new GObject.Class({
    Name: 'ClassicGnome.EyeDropper',
    GTypeName: 'ClassicGnomeEyeDropper',
    Extends: Gtk.HBox,
    Signals: {
        'color-picked': {
            flags: GObject.SignalFlags.RUN_LAST,
            param_types: [ GObject.TYPE_STRING ]
        },
    },

    _init: function() {
        this.parent();
        this.button = new Gtk.Button("");
        this.button.set_tooltip_text(_("Click the eyedropper, then click a color anywhere on your screen to select that color"));
        this.button.set_image(Gtk.Image().new_from_stock(Gtk.STOCK_COLOR_PICKER, Gtk.IconSize.BUTTON));
        this.button.get_property('image').show();
        this.button.set_events(Gdk.EventMask.POINTER_MOTION_MASK | Gdk.EventMask.POINTER_MOTION_HINT_MASK);

        this.pack_start(this.button, false, false, 2);

        this.bp_handler = null;
        this.br_handler = null;
        this.kp_handler = null;

        this.button.connect("clicked", Lang.bind(this, this.on_button_clicked));
    },

    on_button_clicked: function(widget) {
        let screen = widget.get_screen();
        this.time = Gtk.get_current_event_time();
        this.device = Gtk.get_current_event_device();

        this.grab_widget = new Gtk.Window(Gtk.WindowType.POPUP);
        this.grab_widget.set_screen(screen);
        this.grab_widget.resize(1, 1);
        this.grab_widget.move(-100, -100);
        this.grab_widget.show();

        this.grab_widget.add_events(Gdk.EventMask.BUTTON_RELEASE_MASK | Gdk.EventMask.BUTTON_PRESS_MASK | Gdk.EventMask.POINTER_MOTION_MASK);
        let toplevel = widget.get_toplevel();

        if (isinstance(toplevel, Gtk.Window)) {
            if (toplevel.has_group())
                toplevel.add_window(grab_widget);
        }
        let window = this.grab_widget.get_window();

        let picker_cursor = new Gdk.Cursor(screen.get_display(), Gdk.CursorType.CROSSHAIR);

        let grab_status = this.device.grab(window, Gdk.GrabOwnership.APPLICATION, false,
                                           Gdk.EventMask.BUTTON_RELEASE_MASK | Gdk.EventMask.BUTTON_PRESS_MASK | Gdk.EventMask.POINTER_MOTION_MASK,
                                           picker_cursor, this.time);

        if (grab_status != Gdk.GrabStatus.SUCCESS)
            return;

        Gtk.device_grab_add(this.grab_widget, this.device, true);

        this.bp_handler = this.grab_widget.connect("button-press-event", Lang.bind(this, this.mouse_press));
        this.kp_handler = this.grab_widget.connect("key-press-event", Lang.bind(this, this.key_press));
    },

    mouse_press: function(widget, event) {
        if ((event.type == Gdk.EventType.BUTTON_PRESS) && (event.button == 1)) {
            this.br_handler = widget.connect("button-release-event", Lang.bind(this, this.mouse_release));
            return true;
        }
        return false;
    },

    key_press: function(widget, event) {
        let [screen, x_root, y_root] = this.device.get_position()
        if (event.keyval == Gdk.KEY_Escape) {
            this.ungrab(this.device);
            return true;
        } else if (event.keyval in [Gdk.KEY_space, Gdk.KEY_Return, Gdk.KEY_ISO_Enter, Gdk.KEY_KP_Enter, Gdk.KEY_KP_Space]) {
            this.grab_color_at_pointer(event, screen, x_root, y_root);
            return true;
        }
        return false;
    },

    mouse_release: function(widget, event) {
        let [screen, x, y] = this.device.get_position();
        if (event.button != 1)
            return false;
        this.grab_color_at_pointer(event, screen, event.x_root, event.y_root);
        return true;
    },

    grab_color_at_pointer: function(event, screen, x_root, y_root) {
        let device = this.device;
        let window = screen.get_root_window();
        let pixbuf = Gdk.pixbuf_get_from_window(window, x_root, y_root, 1, 1);
        let image = pixbuf2Image(pixbuf);

        let [r, g, b] = image.getpixel((0, 0));

        let color = Gdk.RGBA();
        color.red = r / 255.0;
        color.green = g / 255.0;
        color.blue = b / 255.0;
        this.emit('color-picked', color.to_string());
        this.ungrab(device);
    },

    ungrab: function(device) {
        device.ungrab(this.time);
        Gtk.device_grab_remove(this.grab_widget, device);
        this.grab_widget.handler_disconnect(this.bp_handler);
        this.grab_widget.handler_disconnect(this.br_handler);
        this.grab_widget.handler_disconnect(this.kp_handler);
    },
});
