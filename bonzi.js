(function() {
     const windowTemplate = `
        <appcontentholder class="bonzi-pet-container">
            <petcontain>
                <div id="pet"></div>
                <div class="speech-bubble" id="bonzi-speech-bubble">
                    <span id="bonzi-text"></span>
                    <input type="text" id="bonzi-input" style="display: none;" spellcheck="false">
                    <div id="bonzi-menu" style="display: none;">
                        <winbutton data-action="joke"><btnopt>Tell a Joke</btnopt></winbutton>
                        <winbutton data-action="sing"><btnopt>Sing a Song</btnopt></winbutton>
                        <winbutton data-action="trick-user"><btnopt>Powerful Utilities</btnopt></winbutton>
                        <winbutton data-action="exit"><btnopt>Exit</btnopt></winbutton>
                    </div>
                </div>
            </petcontain>
        </appcontentholder>
    `;

    const loadScriptOrStyle = (path, type) => {
        return new Promise((resolve, reject) => {
            let element;
            if (type === 'js') {
                element = document.createElement('script');
                element.src = path;
            } else if (type === 'css') {
                element = document.createElement('link');
                element.rel = 'stylesheet';
                element.href = path;
            }
            element.onload = () => resolve(element);
            element.onerror = () => reject(new Error(`Failed to load ${path}`));
            document.head.appendChild(element);
        });
    };

    registerApp({
        _template: null,
        _instance: null,

        setup: async function() {
            this._template = document.createElement("template");
            this._template.innerHTML = windowTemplate;
        },

        start: async function(options = {}) {
            if (this._instance && document.getElementById(this._instance.hWnd)) {
                wm.focusWindow(this._instance.hWnd);
                return;
            }
            if (!options.installPath) {
                dialogHandler.spawnDialog({ icon: 'error', title: 'BonziBUDDY Error', text: 'Application could not be started. Missing install path.' });
                return;
            }

            const assetBasePath = options.installPath;

            try {
                await loadScriptOrStyle(dm.getVfsUrl(`${assetBasePath}/bonzi.css`), 'css');
                await loadScriptOrStyle(dm.getVfsUrl(`${assetBasePath}/bonzi-logic.js`), 'js');
            } catch (error) {
                dialogHandler.spawnDialog({ icon: 'error', title: 'BonziBUDDY Error', text: 'A required file for the application could not be loaded.' });
                return;
            }

            const windowContents = this._template.content.firstElementChild.cloneNode(true);
            const hWnd = wm.createNewWindow("bonzi", windowContents, { noTaskbarButton: true });
            const selfWindow = wm._windows[hWnd];

            wm.setCaption(hWnd, "BonziBUDDY");
            if (options.icon) {
                wm.setIcon(hWnd, options.icon);
            }

            selfWindow.querySelector('appheader')?.remove();
            selfWindow.querySelector('appcontrols')?.remove();
            selfWindow.querySelector('appresizers')?.remove();
            selfWindow.querySelector('appanimator')?.remove();
            const bonziContent = selfWindow.querySelector('appcontentholder');
            const appContentsWrapper = selfWindow.querySelector('appcontents');
            if (bonziContent && appContentsWrapper) {
                selfWindow.appendChild(bonziContent);
                appContentsWrapper.remove();
            }
            selfWindow.style.cssText = 'background: transparent; border: none; box-shadow: none; padding: 0; z-index: 999999;';
            selfWindow.classList.add("selfsizing", "dialogbox");

            const petElement = selfWindow.querySelector('#pet');
            if (petElement) {
                petElement.style.backgroundImage = `url("${dm.getVfsUrl(`${assetBasePath}/bonzi.gif`)}")`;
            }

            this._instance = new window.BonziLogic(selfWindow, options);

            return hWnd;
        }
    });
})();