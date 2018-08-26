我昨天刚在逼乎上看到这个gnome全局菜单，感觉很酷，跟mac很像，我也在寻找一些把gnome打造成mac样式的办法，想着顺手翻译一下，但是万万没想到，就在昨晚上作者说这个项目停止更新了，卧槽。我只能说，大哥，你等我翻译完你再停止维护阿，我这才刚看到这个牛逼插件，我自己还没装上呢。  

[**discontinued again**](https://gitlab.com/lestcape/Gnome-Global-AppMenu/issues/116)  

停止更新的原因大概是“GTK +不再支持通用可加载模块”，虽然我也不懂这些，原文翻译你看看吧  

[**项目再次停止更新**](https://github.com/jiqing112/Gnome-Global-AppMenu/issues/1) 

Gnome Shell Extension: Gnome Global Application Menu v0.7-Beta is [**discontinued again**](https://gitlab.com/lestcape/Gnome-Global-AppMenu/issues/116)
--------------

Latest update: 24 September 2017 See the [Changelog](CHANGELOG)

![](gnomeGlobalAppMenu%40lestcape/Capture.png)

Description:
--------------

This extension is [free software](LICENSE) and integrates the **Global Menu** (**Application Menu** and **Menu Bar**) support into the Gnome Shell desktop.
It's based on the [patches](https://bugzilla.gnome.org/show_bug.cgi?id=652122) made by [Giovanni Campagna](https://gitlab.gnome.org/gcampagna)
and also used the same idea of the [Gnome Shell Extension AppIndicator](https://github.com/ubuntu/gnome-shell-extension-appindicator)
made by [@rgcjonas](https://github.com/rgcjonas) (which is now part of the ubuntu code).

**Warning:** This is a not official third-party extension. We also don't want donations as we work only for users, not for companies or communities that
receive money or donations.<br />

Special thanks to:
--------------

- [@gcampagna](https://gitlab.gnome.org/gcampagna)          The initial idea of support DbusMenu in Gnome Shell.
- [@rgcjonas](https://github.com/rgcjonas)                  The first extension with the DbusMenu code.
- [@jaszhix](https://github.com/jaszhix)                    Has helped to port the settings to gjs from python.
- [@mtwebster](https://github.com/mtwebster)                Has helped to implement it in the Cinnamon desktop.
- [@collinss](https://github.com/collinss)                  Has helped fix the behavior of firefox and thunderbird.
- [@rilian-la-te](https://gitlab.com/rilian-la-te)          Understand and fix a lot of things.
- [Ubuntu devs](https://github.com/ubuntu/)                 The protocols and patches.
- [Cinnamon devs](https://github.com/linuxmint/cinnamon)    The settings, specially [@JosephMcc](https://github.com/JosephMcc/)
- [Gnome devs](https://gitlab.gnome.org/GNOME/gnome-shell)        The support of most of internal API and toolkit.

Translators:
--------------
- Croatian (hr):	gogo (trebelnik2@gmail.com)
- Dutch (nl_NL):  Tim Visée
- English (en):		Lester Carballo Pérez (lestcape@gmail.com)
- French (fr):		Maestroschan
- Galician (gl):  Fran Diéguez (fran.dieguez@mabishu.com)
- German (de):		Lesik (Lesik@users.noreply.github.com)
- Hungarian (hu): Balázs Úr (urbalazs@gmail.com)
- Italian (it):   Matteo Iervasi (matteoiervasi@gmail.com)
- Russian (ru):   DragonicUA
- Spanish (es):		Lester Carballo Pérez (lestcape@gmail.com)
- Ukrainian (uk): Alice Liddell (e-liss@tuta.io)

--------------

Known issues (Try at your own risk):
--------------
* (**General Applications**) Not all apps have been tested and for the untested applications, it is possible a failure caused by a bug in the extension,
please, report it if is working in Unity. Also, in some exceptional untested cases the extension may take ages to load and freeze Gnome Shell forever.
* (**General Applications**) There are some unsupported apps that can't be integrated into the extension, like Blender, which has its own GUI toolkit.
* (**General Applications**) This extension can only read the standard Dbus menu structure of Gtk and Qt applications· So, we can't resolve or patch directly
any problematic application that not export the menu, or if is not exported properly. We also can't do anything if you used an alternative internally
implementation that not export the DBus menu structure for some applications. We are happy to include the support to any alternative implementation,
if is provided an appropriate Dbus menu structure.
* (**Gnome Applications**) Some Gnome applications, remove the possibility to export the menubar in "recently" versions. As a "solution" you can use
some alternative applications instead. For example, use [Nemo](https://github.com/linuxmint/nemo) instead of [Nautilus](https://gitlab.gnome.org/GNOME/nautilus)
and use [okular](https://okular.kde.org) instead of [evince](https://gitlab.gnome.org/GNOME/evince).
* (**Java Applications**) The java applications support with JAyatana is experimental and buggy. 
What occurs is that sometimes the JavaEmbeddedFrame can steal the menu to the main window. Luckily, a Shell restart after opening a java application would fix the problem in most cases.
Also, Jayatana do not reuse the same menu item id's for all layout-updates and this fact will casue a menu flicker while componets are rendering all again.
This last problem has been tried to solve in the [jayatana fork](https://gitlab.com/vala-panel-project/vala-panel-appmenu/tree/master/subprojects/jayatana) of @rilian-la-te.
* (**Wayland Applications**) The extension will not work in Wayland, for the Gtk Windows that are not a GtkApplicationWindow. Also, the gnome-terminal application doesn't work in Wayland and
like this app already handled all the menu bar mechanism from inside himself, we can not do anything from our side to resolve that situation.

Guidelines for bug reports:
--------------
Unfortunately, this extension is not completely bug free and will probably never be.
In order to successfully resolve the issues you need to provide some data:

* Your distribution, Shell version and extension version (something like "latest git" or "latest from spices" is sufficient).
* What package you use, examples: appmenu-gtk-module, unity-gtk-module, appmenu-qt, appmenu-qt5 and jayatana.
* Instructions how to reproduce it. **This is the single most important point**. Bugs that [can't be reproduced](http://xkcd.com/583/) can't be fixed either.

To report bugs, request new features and make suggestions, please create a new report [here](https://gitlab.com/lestcape/Gnome-Global-AppMenu/issues).
Also you can send us a merge requests [here](https://gitlab.com/lestcape/Gnome-Global-AppMenu/merge_requests).

**Please note:** Bugs which don't provide the necessary information may be closed as "invalid" without prior notice.

Installation instructions:
--------------
1. To get **Qt** menus to work, install your distribution's appmenu-qt packages. But please note that the appmenu-qt5 (if exist) is buggy and is not needed or recommended,
because qt5 have this functionality embedded. In Ubuntu 18.04, for example, this involves typing **sudo apt-get install appmenu-qt**.
2. To get Gtk(2/3) menus to work, install the appmenu-gtk-module or unity-gtk-module packages as your choice (explanation below). **If both are installed appmenu-gtk-module will have the preference**.
3. To get java  menus to work, install the [**jayatana](https://code.google.com/archive/p/java-swing-ayatana/) pakage. In Ubuntu 18.04, for example, this involves typing **sudo apt-get install jayatana**.
4. Restart your computer.
5. Download this extension from its [**website**](https://gitlab.com/lestcape/Gnome-Global-AppMenu/-/archive/master/Gnome-Global-AppMenu-master.zip).
6. Unzip the downloaded file and copy the **sub**folder gnomeGlobalAppMenu@lestcape (**NOT the MASTER folder**) to ~/.local/share/gnome-shell/extensions/
7. Restart Gnome Shell.
8. Enable the extension in Gnome Tweak Tool.
9. Log out and then back in.

Install appmenu-gtk-module:
--------------
This extension is designed to be used with the  [**appmenu-gtk-module**](https://gitlab.com/vala-panel-project/vala-panel-appmenu/tree/master/subprojects/appmenu-gtk-module)
fork of the [**unity-gtk-module**](https://launchpad.net/unity-gtk-module) packages and also this is the preferable package if both are installed. As this package is distributed
with the [**Mate Desktop**](https://mate-desktop.org), it can be installed from the same source where you can install this desktop environment. In Ubuntu 18.04, for example,
this involves typing **sudo apt-get install appmenu-gtk2-module appmenu-gtk3-module**.

* **Ubuntu**, **Debian** and **Fedora** users, this packages are in the official repositories.
* **Arch** users, you will need to use the @rilian-la-te [**source**](https://aur.archlinux.org/packages/?SeB=m&K=rilian).
* **Wayland** users, we are working to support wayland, but the version that exist in the official repository of your distro, probably won't work with wayland yet.

Install unity-gtk-module:
--------------
This extension can be used with the standard [**gtk modules packages**](https://launchpad.net/unity-gtk-module) and patches that Ubuntu provide to be used on Unity desktop.
But you will probably need to use some equivalent packages depending on your specific distro. Install it in Ubuntu 18.04, for example, involves typing
**sudo apt-get install unity-gtk2-module unity-gtk3-module**.

* **Debian** and **Arch** users, there are not any compiled version.
* **Ubuntu** and **Fedora** users, this packages are in the official repositories, but please see: In Fedora, the Gtk2 applications are not patched to work propertly.
* **Wayland** users, the official unity-gtk-module have not support for Wayland. A source code of unity-gtk-module with Wayland support can be found [**here**](https://gitlab.com/lestcape/unity-gtk-module).

Uninstallation instructions:
--------------
1. Disable the extension.
2. Reset the gsettings values:
  * ```gsettings reset org.gnome.settings-daemon.plugins.xsettings overrides```
  * ```gsettings reset org.gnome.settings-daemon.plugins.xsettings enabled-gtk-modules```
3. If you don't use a global menu in other desktop, remove the previously installed packages as well.
Restart your computer.

--------------

Thank you very much for using this product.
Lester.
