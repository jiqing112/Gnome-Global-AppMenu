
const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;

const MyExtension = imports.misc.extensionUtils.getCurrentExtension();
const ExtensionManager = MyExtension.imports.extensionManager;

var applet;

function init() {
    applet = null;
}

function enable() {
    if(!applet) {
        applet = ExtensionManager.main(MyExtension.metadata, St.Side.TOP, Main.panel.actor.height, 1);
        Mainloop.idle_add(Lang.bind(this, function () {
            applet._onAppletAddedToPanel(false);
            applet.setOrientation(St.Side.TOP);
            return false;
        }));
    }
}

function disable() {
    if(applet) {
        applet._onAppletRemovedFromPanel(true);
        applet = null;
    }
}
