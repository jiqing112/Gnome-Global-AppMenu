
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;

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
    let activities = Main.panel.statusArea['activities'];
    if(activities != null) {
        activities.actor.get_parent().add_actor(applet.actor);
        applet.on_applet_added_to_panel(false);
        applet.setOrientation(St.Side.TOP);
    }
}

function disable() {
    let parent = applet.actor.get_parent();
    if(parent) {
        parent.remove_actor(applet.actor);
        applet.on_applet_removed_from_panel();
        let activities = Main.panel.statusArea['activities'];
        if(activities != null) {
            parent.add_actor(activities.actor);
        }
    }
}
