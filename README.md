Gnome Shell Extension: Gnome Global Application Menu Version: v0.7-Beta

Last update: 16 April 2017

***
Special thanks to:
--------------

- rgcjonas             (https://github.com/rgcjonas)               The initial code.
- Canonical devs       (http://www.canonical.com/)                 The protocols and patches.
- Cinnamon devs        (https://github.com/linuxmint/Cinnamon)     The support (specially: https://github.com/mtwebster).
- Gnome Shell devs     (https://github.com/GNOME/gnome-shell)      The support.
- rilian-la-te         (https://github.com/rilian-la-te)           Understand and fix a lot of things.
- collinss             (https://github.com/collinss)               Has helped fix the behavior of firefox and thunderbird.

Author of language translation:
--------------
- Croatian(Hr):     gogo (trebelnik2@gmail.com)
- English(En):      Lester Carballo Pérez(lestcape@gmail.com)
- Spanish(Es):      Lester Carballo Pérez(lestcape@gmail.com)

--------------
![](https://raw.githubusercontent.com/lestcape/Gnome-Global-AppMenu/master/gnomeGlobalAppMenu%40lestcape/Capture.png)

Description
--------------
**Warning:** This is a third-party extension, is not official.

This extension integrates the Ubuntu-Unity Application Menu (Global Menu) support into the Gnome Shell Desktop.

It's used the same idea of the Gnome Shell extension made by rgcjonas:

https://github.com/rgcjonas/gnome-shell-extension-appindicator

Known issues (Try at your own risk):
--------------
* Not all apps are tested and then the extension could takes ages to load and can freeze Gnome Shell forever.
* There are some unsupported apps that can not be integrate into the extension, like Blender, as has his own GUI toolkit.
* For some untested applications, it is possible a failure caused by a bug in the extension. Please, report it if is working in Unity.
* Some Gnome applications like Nautilus, remove the possibility to export the menu in recently versions (you can use instead an alternative applications).

Experimental JAyatana support (try at your own risk):
--------------
JAyatana it's buggy and was removed intentional from Intellij Idea, Ubuntu 15.04 and others.

Currently you can use the JAyatana support as a decision inside the extension. This will work for some java applications only and for others with several problems or also will not work. Some time you will need restart the Shell to see the menu, like for example with JDownloader. 

I really don't know if this is caused by an improperly handled of the JavaEmbeddedFrame by Mutter (The Gnome Shell Windows Manager), if it's an specific behavior/bugs of JAyatana or whatever. What occurs is that some time the JavaEmbeddedFrame can steal the menu to the main windows and some time not. So, a Shell restart after opening JDownloader would fix the problem in most of cases, in others is possible you will need to kill the JDownloader process and then opening the application again. To remove the experimental tag, the JAyatana project will need to implement this stuff at less:

1. Use the same sender in the DbusMenu implementation for the same windows and not a new one.
2. Use the same menu item id for all layout-updates and not a new one.

This is because force to reload all items and this is pretty hard for javascript.

Aditionally, we need to find how resolve the JavaEmbeddedFrame situation.

Change log
--------------
0.7-Beta
 - Initialized the support into the Gnome Shell enviroment.

0.6-Beta
 - Added Croatian language, thanks to https://github.com/muzena
 - Added JAyanta support.
 - Added keyboard navegation.
 - Added effects.
 - Added vector box: https://github.com/linuxmint/Cinnamon/issues/1775.
 - Improve the menu speed (preload kde menu when is possible).
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
  - Fix xchat and possible other gtk applications.

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

https://github.com/lestcape/Gnome-Global-AppMenu/issues

You can also send us a pull request:

https://github.com/lestcape/Gnome-Global-AppMenu/pulls

Installation instructions:
--------------
1. Install the unity-gtk-module packages (explanation below).
2. Restart your computer.
3. Download this extension from their website : https://github.com/lestcape/Gnome-Global-AppMenu
4. Unzip the downloaded file and copy the folder gnomeGlobalAppMenu@lestcape at ~/.local/share/gnome-shell/extensions/
5. Enable the extension in Gnome Tweek Settings.
6. Logout and login again.

unity-gtk-module:
--------------
This extension is designed to be used with the standars gtk modules packages (https://launchpad.net/unity-gtk-module) and patches that Ubuntu provide to
be used on Unity desktop.

Thats then will depend of your specific distro and possible you will need to use some equivalent different packages.

* Ubuntu users, be happy, you don't need to do anything if unity is working. :)
* Mint users, all Ubuntu packages that we needed are availables on Mint repositories as well and can be installed.
  - Minimum requirements: sudo apt-get install unity-gtk2-module unity-gtk3-module
* Arch users, you will need to use the rilian-la-te source (https://aur.archlinux.org/packages/?SeB=m&K=rilian).
* Fedora users, the unity-gtk-modules are in the official repositories.

This extension can only read the standard Dbus menu structure (Gtk/Kde), so we can not resolve or patch directly any problematic application that not export the menu, or if is not exported properly. We also can not do anything if you used an alternative internally implementation that not export the DBus menu structure for some applications. 

We are happy to include the support to any alternative implementation, if is provided an appropriate Dbus menu structure.

Uninstall instructions:
--------------
1. Disable the extension.
2. Reset the gsettings values:

  * gsettings reset org.gnome.settings-daemon.plugins.xsettings overrides
  * gsettings reset org.gnome.settings-daemon.plugins.xsettings enabled-gtk-modules

3. If you don't use a global menu in other desktop, remove also the packages that you install.
Restart your computer.

==============
Thank you very much for using this product.
Lester.
