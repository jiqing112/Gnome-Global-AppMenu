
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;

//const GIRepository = imports.gi.GIRepository;
const MyExtension = imports.misc.extensionUtils.getCurrentExtension();
const ExtensionManager = MyExtension.imports.extensionManager;
const Environment = MyExtension.imports.environment;

let applet;

function init() {
    Environment.init();
    applet = ExtensionManager.main(MyExtension.metadata, St.Side.TOP, Main.panel.actor.height, 1);
}

function enable() {

    Mainloop.idle_add(Lang.bind(this, function () {
        let _children = Main.panel._leftBox.get_children();

        Main.panel._leftBox.insert_child_at_index(applet.actor, _children.length - 1);
        applet.on_applet_added_to_panel(false);
        applet.setOrientation(St.Side.TOP);

        return false;
    }));
}

function disable() {
    let parent = applet.actor.get_parent();
    if(parent) {
        parent.remove_actor(applet.actor);
        applet.on_applet_removed_from_panel();
    }
}
