Gnome Shell Extension: Gnome Global Application Menu v0.7-Beta
--------------

We don't want donations, we work only for users and not for companies or communities that receive money or donations.

Latest update: 24 September 2017

***
Special thanks to:
--------------

- [@rgcjonas](https://github.com/rgcjonas)                  The initial code.
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
- Dutch (nl_NL):  Tim Visée ()
- English (en):		Lester Carballo Pérez(lestcape@gmail.com)
- French (fr):		Maestroschan
- Galician (gl):  Fran Diéguez (fran.dieguez@mabishu.com)
- German (de):		Lesik (Lesik@users.noreply.github.com)
- Hungarian (hu): Balázs Úr (urbalazs@gmail.com)
- Italian (it):   Matteo Iervasi (matteoiervasi@gmail.com)
- Russian (ru):   DragonicUA
- Spanish (es):		Lester Carballo Pérez(lestcape@gmail.com)
- Ukrainian (uk): Alice Liddell (e-liss@tuta.io)

--------------

![](gnomeGlobalAppMenu%40lestcape/Capture.png)

Description
--------------
**Warning:** This is a third-party extension, not official.

This extension integrates the Ubuntu-Unity Application Menu (Global Menu) support into the Gnome Shell desktop.

It's based on patches made by Giovanni Campagna:
https://bugzilla.gnome.org/show_bug.cgi?id=652122

Also used the same idea of the Gnome Shell extension made by [@rgcjonas](https://github.com/rgcjonas) (with is now part of ubuntu code):
https://github.com/ubuntu/gnome-shell-extension-appindicator

Known issues (Try at your own risk):
--------------
* Not all apps are tested, so the extension may take ages to load and freeze Gnome Shell forever.
* There are some unsupported apps that can't be integrated into the extension, like Blender, which has its own GUI toolkit.
* For some untested applications, it is possible a failure caused by a bug in the extension. Please, report it if is working in Unity.
* Some Gnome applications like Nautilus, remove the possibility to export the menu in recent versions (you can use alternative applications instead).
* The java applications support with JAyatana is experimental and buggy. 
What occurs is that sometimes the JavaEmbeddedFrame can steal the menu to the main window. Luckily, a Shell restart after opening a java application would fix the problem in most cases.
Also, Jayatana do not reuse the same menu item id's for all layout-updates and this fact will casue a menu flicker while componets are rendering all again.
* This extension can only read the standard Dbus menu structure (Gtk/Kde), so we can't resolve or patch directly any problematic application that not export the menu,
or if is not exported properly. We also can't do anything if you used an alternative internally implementation that not export the DBus menu structure for some applications.
We are happy to include the support to any alternative implementation, if is provided an appropriate Dbus menu structure.
* In Wayland, dosen't not work with the gnome-terminal application as this application have his particular implementation, this bug is in his side.
* In Wayland, will not work for windows that are not a GtkApplicationWindow.


Changelog
--------------
0.7-Beta
 - Initialized the support into the Gnome Shell enviroment.
 - A lot of bug fixed to work inside gnome shell.
 - A lot of translation was added. Thank to different peoples.
 - The settings was ported to gjs.
 - Added a gnome shell provider to search for menu actions.
 - Added a hud-menu to search for menu action.
 - Was improved the support to have several dbusmenu providers.
 - More experimental options was added, but they remain incomplete.
 - Was ported to our API the appmenu of gnome-shell.
 - Was introduced a hack to disable the appmenu of gnome.

0.6-Beta
 - Added Croatian language, thanks to [@muzena](https://github.com/muzena)
 - Added JAyatana support.
 - Added keyboard navigation.
 - Added effects.
 - Added vector box: https://github.com/linuxmint/Cinnamon/issues/1775.
 - Improved the menu speed (preload kde menu when is possible).
 - Fixed some issues.

0.5-Beta
 - Fixed Firefox, Thunderbird and Mint Update Manager.
 - Some little performance improvement.
 - Removed the utility file.

0.4-Beta
 - Now the gtk submenu will be updated when opening (will fix some other problems for Open Office).
 - Fixed the extension domain translation.
 - Corrections in the submenus operations.
 - Fixed other internal problems.

0.3-Beta
 - Don't show icon on the panel submenu item, is ugly and out of the standard.
 - Use a Shell radiobutton instead of an special text.
 - Try to add more gtk icons using the action context (could be wrong).
 - Add an option to desaturate the internal items icon.
 - Fixed the extension instance id problem in settings.
 - Try to fix Open Office (Is possible that will not show the menu on some contexts).

0.2-Beta
  - Not crash the Shell when firefox drop the menu.
  - Fixed xchat and possible other gtk applications.

0.1-Beta
  - Initial release.

This program is free software:
--------------
You can redistribute it and/or modify it under the terms of the GNU General Public License as published by the
Free Software Foundation, either version 2 of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied
warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with this program.
If not, see http://www.gnu.org/licenses/.

Guidelines for bug reports
--------------
Unfortunately, this extension is not completely bug free and will probably never be.
In order to successfully resolve the issues you need to provide some data:

* Your distribution, Shell version and extension version (something like "latest git" or "latest from spices" is sufficient).
* Instructions how to reproduce it. **This is the single most important point**. Bugs that [can't be reproduced](http://xkcd.com/583/) can't be fixed either.
* Bugs which don't provide the necessary information may be closed as "invalid" without prior notice.

To report bugs, request new features and make suggestions, please visit:

https://gitlab.com/lestcape/Gnome-Global-AppMenu/issues

You can also send us a merge requests:

https://gitlab.com/lestcape/Gnome-Global-AppMenu/merge_requests

Installation instructions:
--------------
1. To get QT menus to work, install your distribution's appmenu-qt packages. But please note that the appmenu-qt5 (if exist) is buggy and is not needed or recommended, because qt5 have this functionality embedded. In Ubuntu 18.04, for example, this involves typing **sudo apt-get install appmenu-qt**.
2. Install the unity-gtk-module or appmenu-gtk-module packages as your choice (explanation below). **If both are installed appmenu-gtk-module will have the preference**.
3. If you want support for java applications install the jayatana pakage. In Ubuntu 18.04, for example, this involves typing **sudo apt-get install jayatana**.
4. Restart your computer.
5. Download this extension from its website: https://gitlab.com/lestcape/Gnome-Global-AppMenu
6. Unzip the downloaded file and copy the **sub**folder gnomeGlobalAppMenu@lestcape (**NOT the MASTER folder**) to ~/.local/share/gnome-shell/extensions/
7. Restart Gnome Shell.
8. Enable the extension in Gnome Tweak Tool.
9. Log out and then back in.

Install appmenu-gtk-module:
--------------
This extension is designed to be used with the  [**appmenu-gtk-module**](https://gitlab.com/vala-panel-project/vala-panel-appmenu/tree/master/subprojects/appmenu-gtk-module)
fork of the [**unity-gtk-module**](https://launchpad.net/unity-gtk-module) packages and also this is the preferable package if both are installed. As this package is distributed
with the [**Mate Desktop**](https://mate-desktop.org), it can be installed from the same source where you can install the Mate Desktop. In Ubuntu 18.04, for example, this involves typing
**sudo apt-get install appmenu-gtk2-module appmenu-gtk3-module**.

* **Ubuntu**, **Debian** and **Fedora** users, this packages are in the official repositories.
* **Arch** users, you will need to use the rilian-la-te source (https://aur.archlinux.org/packages/?SeB=m&K=rilian).
* **Wayland** users, we are working to support wayland, but the version that exist in the official repository of your distro, probably won't work with wayland yet.

Install unity-gtk-module:
--------------
This extension can be used with the standard gtk modules packages (https://launchpad.net/unity-gtk-module) and patches that Ubuntu provide to be used on Unity desktop.
But you will probably need to use some equivalent packages depending on your specific distro. Install it in Ubuntu 18.04, for example, involves typing
**sudo apt-get install unity-gtk2-module unity-gtk3-module**.

* **Debian** and **Arch** users, there are not any compiled version.
* **Ubuntu** and **Fedora** users, this packages are in the official repositories, but please see: In Fedora, the Gtk2 applications are not patched to work propertly.
* **Wayland** users, the official unity-gtk-module have not support for Wayland. A source code of unity-gtk-module with Wayland support can be found here: https://gitlab.com/lestcape/unity-gtk-module

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
