/* -*- mode: js; js-basic-offset: 4; indent-tabs-mode: nil -*- */
/* ========================================================================================================
 * SettingsDbusClient.js - A GDBus client to our settings -
 * ========================================================================================================
 */

const Lang = imports.lang;
const Signals = imports.signals;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;

const DbusSettingsIface =
    '<node> \
        <interface name="org.Cinnamon"> \
            <method name="Eval"> \
                <arg type="s" direction="in" name="script" /> \
                <arg type="b" direction="out" name="success" /> \
                <arg type="s" direction="out" name="result" /> \
            </method> \
            <method name="ScreenshotArea"> \
                <arg type="b" direction="in" name="include_cursor"/> \
                <arg type="i" direction="in" name="x"/> \
                <arg type="i" direction="in" name="y"/> \
                <arg type="i" direction="in" name="width"/> \
                <arg type="i" direction="in" name="height"/> \
                <arg type="b" direction="in" name="flash"/> \
                <arg type="s" direction="in" name="filename"/> \
            </method> \
            <method name="ScreenshotWindow"> \
                <arg type="b" direction="in" name="include_frame"/> \
                <arg type="b" direction="in" name="include_cursor"/> \
                <arg type="b" direction="in" name="flash"/> \
                <arg type="s" direction="in" name="filename"/> \
            </method> \
            <method name="Screenshot"> \
                <arg type="b" direction="in" name="include_frame"/> \
                <arg type="b" direction="in" name="flash"/> \
                <arg type="s" direction="in" name="filename"/> \
            </method> \
            <method name="ShowOSD"> \
                <arg type="a{sv}" direction="in" name="params"/> \
            </method> \
            <method name="FlashArea"> \
                <arg type="i" direction="in" name="x"/> \
                <arg type="i" direction="in" name="y"/> \
                <arg type="i" direction="in" name="width"/> \
                <arg type="i" direction="in" name="height"/> \
            </method> \
            <method name="highlightXlet"> \
                <arg type="s" direction="in" /> \
                <arg type="s" direction="in" /> \
                <arg type="b" direction="in" /> \
            </method> \
            <method name="highlightPanel"> \
                <arg type="i" direction="in" /> \
                <arg type="b" direction="in" /> \
            </method> \
            <method name="addPanelQuery"> \
            </method> \
            <method name="destroyDummyPanels"> \
            </method> \
            <method name="activateCallback"> \
                <arg type="s" direction="in" /> \
                <arg type="s" direction="in" /> \
                <arg type="s" direction="in" /> \
            </method> \
            <method name="updateSetting"> \
                <arg type="s" direction="in" /> \
                <arg type="s" direction="in" /> \
                <arg type="s" direction="in" /> \
                <arg type="s" direction="in" /> \
            </method> \
            <method name="switchWorkspaceRight" /> \
            <method name="switchWorkspaceLeft" /> \
            <method name="switchWorkspaceUp" /> \
            <method name="switchWorkspaceDown" /> \
            <method name="JumpToNewWorkspace" /> \
            <method name="RemoveCurrentWorkspace" /> \
            <method name="ShowExpo" /> \
            <method name="GetRunningXletUUIDs"> \
                <arg type="s" direction="in" /> \
                <arg type="as" direction="out" /> \
            </method> \
            <method name="ReloadXlet"> \
                <arg type="s" direction="in" name="uuid" /> \
                <arg type="s" direction="in" name="type" /> \
            </method> \
            <property name="OverviewActive" type="b" access="readwrite" /> \
            <property name="ExpoActive" type="b" access="readwrite" /> \
            <property name="CinnamonVersion" type="s" access="read" /> \
            <signal name="XletAddedComplete"> \
                <arg type="b" direction="out" /> \
                <arg type="s" direction="out" /> \
            </signal> \
            <method name="PushSubprocessResult"> \
                <arg type="i" direction="in" name="process_id" /> \
                <arg type="s" direction="in" name="result" /> \
            </method> \
            <method name="ToggleKeyboard"/> \
        </interface> \
    </node>';

const ProxyWrapper = Gio.DBusProxy.makeProxyWrapper(DbusSettingsIface);

function ClientSettings() {
    this._init();
}

ClientSettings.prototype = {
    _init: function() {
        this._proxy = new ProxyWrapper(Gio.DBus.session, 'org.Cinnamon', '/org/Cinnamon', Lang.bind(this, this._clientReady), null);
    },

    _clientReady: function(result, error) {
        if (error) {
            //FIXME: show message to the user?
            this._proxy = null;
            global.log("Could not initialize settings proxy: " + error);
            return;
        }
        if (this._proxy) {
            global.log("Initialize settings proxy");
            this._proxy.connectSignal("XletAddedComplete", Lang.bind(this, this._onXletAddedComplete));
        }
    },

    getRunningXletUUIDs: function(collection_type) {
        return this._proxy.GetRunningXletUUIDsRemote(collection_type);
    },

    reloadXlet: function(uuid, collection_type) {
        this._proxy.ReloadXletRemote(uuid, collection_type);
    },

    _onXletAddedComplete: function(proxy, success, uuid) {
        this.emit("xlet-added-complete", success, uuid);
    },

    addPanelQuery: function() {
        this._proxy.addPanelQueryRemote();
    },

    highlightPanel: function(panel_id, state) {
        this._proxy.highlightPanelRemote(panel_id, state);
    },

    highlightXlet: function(uuid, instance_id, state) {
        this._proxy.highlightXletRemote(uuid, instance_id, state);
    },

    activateCallback: function(xletCallback, uuid, instance_id) {
        this._proxy.activateCallbackRemote(xletCallback, uuid, instance_id);
    },

    updateSetting: function(uuid, instance_id, key, json_value) {
        this._proxy.updateSettingRemote(uuid, instance_id, key, json_value);
    },

    destroyDummyPanels: function() {
        this._proxy.destroyDummyPanelsRemote();
    },
}
Signals.addSignalMethods(ClientSettings.prototype);
