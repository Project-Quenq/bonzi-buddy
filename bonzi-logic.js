if (typeof window.BonziLogic === 'undefined') {
class BonziLogic {
  constructor(selfWindow, options) {
    this.hWnd = selfWindow.id;
    this.selfWindow = selfWindow;
    this.assetBasePath = options.installPath;
    this.iconPath = options.icon;

    this.petElement = selfWindow.querySelector("#pet");
    this.speechBubble = selfWindow.querySelector("#bonzi-speech-bubble");
    this.speechText = selfWindow.querySelector("#bonzi-text");
    this.inputField = selfWindow.querySelector("#bonzi-input");
    this.menu = selfWindow.querySelector("#bonzi-menu");

    this.lyricTimeouts = [];
    this.wanderInterval = null;
    this.audioPlayer = new Audio();
    this.isDragging = false;
    this.conversationEnded = false;
    this.menuVisible = false;

    this.currentAudioEndListener = null;
    this.currentMetadataListener = null;

    this.currentSongIndex = 0;

    this.conversationIndex = 0;
    this.conversation = [
      {
        text: "Hey there! I'm BonziBUDDY!",
        category: "greetings",
        audio: "greeting_1"
      },
      {
        text: "It's great to meet you! I'm here to help.",
        category: "greetings",
        audio: "greeting_2"
      }
    ];

    this.init();
  }

  async init() {
    this.petElement.addEventListener("mousedown", (e) => this.dragStart(e));
    this.petElement.addEventListener("touchstart", (e) => this.dragStart(e), {
      passive: false,
    });

    this.setupActionButtons();
    this.selfWindow.addEventListener("wm:windowClosed", () => this.cleanup(), {
      once: true,
    });

    this.startConversation();
  }

  cleanup() {
    this.lyricTimeouts.forEach(clearTimeout);
    if (this.wanderInterval) clearInterval(this.wanderInterval);
    this.audioPlayer.pause();
    this.audioPlayer.src = "";
    if (this.currentAudioEndListener) {
      this.audioPlayer.removeEventListener(
        "ended",
        this.currentAudioEndListener,
      );
      this.audioPlayer.removeEventListener(
        "error",
        this.currentAudioEndListener,
      );
      this.currentAudioEndListener = null;
    }
    if (this.currentMetadataListener) {
      this.audioPlayer.removeEventListener(
        "loadedmetadata",
        this.currentMetadataListener,
      );
      this.currentMetadataListener = null;
    }
  }

  dragStart(e) {
    e.preventDefault();
    e.stopPropagation();

    clearInterval(this.wanderInterval);
    this.selfWindow.style.transition = "none";

    const el = this.selfWindow;
    const isTouchEvent = e.type.startsWith("touch");

    const startX = isTouchEvent ? e.touches[0].clientX : e.clientX;
    const startY = isTouchEvent ? e.touches[0].clientY : e.clientY;
    const startTop = el.offsetTop;
    const startLeft = el.offsetLeft;

    let hasMoved = false;

    const dragMove = (ev) => {
      ev.stopPropagation();

      hasMoved = true;

      const currentX = isTouchEvent ? ev.touches[0].clientX : ev.clientX;
      const currentY = isTouchEvent ? ev.touches[0].clientY : ev.clientY;

      const dx = currentX - startX;
      const dy = currentY - startY;

      el.style.left = `${startLeft + dx}px`;
      el.style.top = `${startTop + dy}px`;
    };

    const dragEnd = () => {
      document.removeEventListener(
        isTouchEvent ? "touchmove" : "mousemove",
        dragMove,
      );
      document.removeEventListener(
        isTouchEvent ? "touchend" : "mouseup",
        dragEnd,
      );

      if (!hasMoved) {
        this.handleClick(e);
      }

      this.selfWindow.style.transition =
        "left 1s ease-in-out, top 1s ease-in-out";
      this.startWandering();
    };

    document.addEventListener(
      isTouchEvent ? "touchmove" : "mousemove",
      dragMove,
      { passive: false },
    );
    document.addEventListener(isTouchEvent ? "touchend" : "mouseup", dragEnd, {
      once: true,
    });
  }

  handleClick(e) {
    if (!this.conversationEnded) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    this.toggleMainMenu();
  }

  toggleMainMenu() {
    this.menuVisible = !this.menuVisible;
    if (this.menuVisible) {
      this.showMainMenu();
    } else {
      this.speechBubble.style.visibility = "hidden";
    }
  }

  showMainMenu() {
    this.audioPlayer.pause();
    this.audioPlayer.src = "";
    if (this.currentAudioEndListener) {
      this.audioPlayer.removeEventListener(
        "ended",
        this.currentAudioEndListener,
      );
      this.audioPlayer.removeEventListener(
        "error",
        this.currentAudioEndListener,
      );
      this.currentAudioEndListener = null;
    }
    if (this.currentMetadataListener) {
      this.audioPlayer.removeEventListener(
        "loadedmetadata",
        this.currentMetadataListener,
      );
      this.currentMetadataListener = null;
    }
    this.audioPlayer = new Audio();
    this.lyricTimeouts.forEach(clearTimeout);
    this.lyricTimeouts = [];
    this.inputField.style.display = "none";
    this.speechText.style.display = "none";
    this.menu.style.display = "flex";
    this.speechBubble.style.visibility = "visible";
    this.menuVisible = true;
  }

  speak(text, category, audioFile, visibleDuration) {
    return new Promise(async (resolve) => {
      this.showMainMenu();
      this.menu.style.display = "none";
      this.speechText.textContent = text;
      this.speechText.style.display = "block";
      this.menuVisible = false;

      let hasResolved = false;
      const onAudioEnd = () => {
        if (hasResolved) return;
        hasResolved = true;
        this.audioPlayer.removeEventListener("ended", onAudioEnd);
        this.audioPlayer.removeEventListener("error", onAudioEnd);
        this.currentAudioEndListener = null;
        if (visibleDuration) {
          setTimeout(() => {
            this.speechBubble.style.visibility = "hidden";
          }, visibleDuration);
        }
        resolve();
      };

      this.currentAudioEndListener = onAudioEnd;
      this.audioPlayer.addEventListener("ended", onAudioEnd, { once: true });
      this.audioPlayer.addEventListener("error", onAudioEnd, { once: true });
      this.audioPlayer.src = dm.getVfsUrl(
        `${this.assetBasePath}/audio/${category}/${audioFile}.mp3`,
      );
      try {
        await this.audioPlayer.play();
      } catch (e) {
        onAudioEnd();
      }
    });
  }

  async startConversation() {
    if (this.conversationEnded) return;
    const step = this.conversation[this.conversationIndex];

    if (!step) {
      this.conversationEnded = true;
      this.speechBubble.style.visibility = "hidden";
      this.startWandering();
      return;
    }

    await this.speak(step.text, step.category, step.audio);
    if (this.conversationEnded) return;

    this.conversationIndex++;
    this.startConversation();
  }

  setupActionButtons() {
    this.menu.querySelectorAll("winbutton").forEach((btn) => {
      btn.onclick = () => this.handleAction(btn.dataset.action);
    });
  }

  async handleAction(action) {
    const songList = [
      {
        name: "Daisy Bell",
        file: "daisy_bell",
        lyrics: [
          {
            time: 0,
            line: "Here's one my mom used to sing to me. I hope you like it.",
          },
          { time: 4, line: "Daisy, Daisy," },
          { time: 8, line: "give me your answer true." },
          { time: 12, line: "I'm half crazy, all for the love of you." },
          {
            time: 20,
            line: "It won't be a stylish marriage, I can't afford a carriage.",
          },
          {
            time: 28,
            line: "But you'll look sweet upon the seat of a bicycle built for two.",
          },
        ],
      },
      {
        name: "Beautiful Dreamer",
        file: "beautiful_dreamer",
        lyrics: [
          { time: 0, line: "Beautiful dreamer, wake unto me," },
          { time: 4, line: "Starlight and dewdrops are waiting for thee;" },
          { time: 10, line: "Sounds of the rude world, heard in the day," },
          { time: 14, line: "Lulled by the moonlight, have all passed away." },
          { time: 20, line: "Beautiful dreamer, queen of my song," },
          { time: 25, line: "List while I woo thee with soft melody;" },
          { time: 31, line: "Gone are the cares of life's busy throng," },
          { time: 36, line: "Beautiful dreamer, awake unto me!" },
          { time: 41, line: "Beautiful dreamer, awake unto me!" },
          { time: 56, line: "Yes, yes, very nice." },
          { time: 58, line: "Stank that violin like you've never had before." },
          {
            time: 61,
            line: "And hopefully you never have before, or else you'll have problems.",
          },
          { time: 74, line: "Beautiful dreamer, out on the sea," },
          { time: 79, line: "Mermaids are chanting the wild lorelei;" },
          { time: 84, line: "Over the streamlet, vapors are borne," },
          { time: 89, line: "Waiting to fade at the bright coming morn." },
          { time: 95, line: "Beautiful dreamer, beam on my heart," },
          { time: 99, line: "E'en as the morn on the streamlet and sea;" },
          { time: 108, line: "Then will all clouds of sorrow depart," },
          { time: 112, line: "Beautiful dreamer, awake unto me!" },
          { time: 116, line: "Beautiful dreamer, awake unto me!" },
        ],
      },
      {
        name: "Jimmy Crack Corn",
        file: "blue_tail_fly",
        lyrics: [
          {
            time: 6,
            line: "When I was young I used to wait on master and hand him his plate,",
          },
          {
            time: 13,
            line: "And pass the bottle when he got dry, and brush away the blue-tail fly.",
          },
          { time: 19, line: "Jimmy crack corn and I don't care," },
          { time: 22, line: "Jimmy crack corn and I don't care," },
          {
            time: 26,
            line: "Jimmy crack corn and I don't care, my master's gone away.",
          },
          {
            time: 32,
            line: "And when he'd ride in the afternoon, I'd follow after with a hickory broom;",
          },
          {
            time: 39,
            line: "The pony being rather shy, when bitten by a blue-tail fly.",
          },
          { time: 45, line: "Jimmy crack corn and I don't care," },
          { time: 48, line: "Jimmy crack corn and I don't care," },
          {
            time: 51,
            line: "Jimmy crack corn and I don't care, my master's gone away.",
          },
          {
            time: 58,
            line: "One day he ride around the farm, the flies so numerous they did swarm;",
          },
          {
            time: 64,
            line: "One chanced to bite him on the thigh, the devil take the blue-tail fly.",
          },
          { time: 71, line: "Jimmy crack corn and I don't care," },
          { time: 74, line: "Jimmy crack corn and I don't care," },
          {
            time: 77,
            line: "Jimmy crack corn and I don't care, my master's gone away.",
          },
          {
            time: 84,
            line: "Jimmy crack corn and I don't care... my master's gone away.",
          },
        ],
      },
      {
        name: "Cindy",
        file: "cindy",
        lyrics: [
          {
            time: 8,
            line: "You ought to see my Cindy, she lives away down south, and she's so sweet the honey bees, they swarm around her mouth.",        
          },
          {
            time: 17,
            line: "The first I seen my Cindy, was standin' in the door, her shoes and stockings in her hand, her feet spread 'round the floor.",  
          },
          { time: 25, line: "Get along home, Cindy, Cindy," },
          { time: 28, line: "Get along home, Cindy, Cindy," },
          {
            time: 30,
            line: "Get along home, Cindy, Cindy, I'll marry you someday.",
          },
          {
            time: 34,
            line: "I wish I was an apple, a-hangin' on a tree, and every time that Cindy passed, she'd take a bite of me.",
          },
          {
            time: 41,
            line: "If I were made of sugar, a-standin' in the town, then every time my Cindy passed, I'd shake some sugar down.",
          },
          { time: 48, line: "I'd shake some sugar down." },
          { time: 51, line: "Get along home, Cindy, Cindy," },
          { time: 53, line: "Get along home, Cindy, Cindy," },
          {
            time: 55,
            line: "Get along home, Cindy, Cindy, I'll marry you someday.",
          },
          {
            time: 59,
            line: "My Cindy got religion, she had it once before, but when she heard my old banjo, she leaped upon the floor.",
          },
          {
            time: 66,
            line: "She kissed me and she hugged me, she called me sugar plum,",
          },
          {
            time: 70,
            line: "She hugged so tight I hardly breathed, I thought my time had come.",
          },
          { time: 75, line: "Get along home, Cindy, Cindy," },
          { time: 78, line: "Get along home, Cindy, Cindy," },
          {
            time: 80,
            line: "Get along home, Cindy, Cindy, I'll marry you someday.",
          },
        ],
      },
    ];
    const jokes = [
      {
        text: "Why don't scientists trust atoms? Because they make up everything!",
        audio: "joke_1",
      },
      {
        text: "Why did the computer go to the doctor? It had a virus!",
        audio: "joke_2",
      },
      { text: "What do you call a fake noodle? An Impasta!", audio: "joke_3" },
      {
        text: "Why was the computer cold? It left its Windows open!",
        audio: "joke_4",
      },
      { text: "What do you call a fish with no eyes? Fsh!", audio: "joke_5" },
      {
        text: "I told my computer I needed a break... Now it won’t stop sending me Kit-Kat ads.",
        audio: "joke_6",
      },
      {
        text: "Why did the scarecrow win an award? Because he was outstanding in his field!",
        audio: "joke_7",
      },
      {
        text: "What is a computer's favorite snack? Microchips!",
        audio: "joke_8",
      },
      {
        text: "How does a computer get drunk? It takes screenshots!",
        audio: "joke_9",
      },
      {
        text: "Why can't a bicycle stand up by itself? Because it's two tired!",
        audio: "joke_10",
      },
    ];

    switch (action) {
      case "joke":
        const joke = jokes[Math.floor(Math.random() * jokes.length)];
        await this.speak(joke.text, "jokes", joke.audio, 2000);
        this.startWandering();
        break;
      case "sing":
        const song = songList[this.currentSongIndex];
        this.playSongWithLyrics(song);
        this.currentSongIndex = (this.currentSongIndex + 1) % songList.length;
        break;
      case "trick-user":
        await this.speak(
          "Hehehe, check out these powerful utilities!",
          "actions",
          "action_trick",
          2000,
        );
        setTimeout(() => explorer.open("E:/Extras"), 100);
        this.startWandering();
        break;
      case "exit":
        wm.closeWindow(this.hWnd);
        break;
    }
  }

  playSongWithLyrics(song) {
    this.showMainMenu();
    this.menu.style.display = "none";
    this.speechText.style.display = "block";
    this.menuVisible = false;

    this.speechText.textContent = "";
    this.speechBubble.style.visibility = "hidden";

    this.audioPlayer.src = dm.getVfsUrl(
      `${this.assetBasePath}/audio/songs/${song.file}.ogg`,
    );

    const onPlayStart = () => {
      song.lyrics.forEach((lyric) => {
        const startTime = lyric.time * 1000;
        const showTimeout = setTimeout(() => {
          this.speechBubble.style.visibility = "visible";
          this.speechText.textContent = lyric.line;
        }, startTime);
        this.lyricTimeouts.push(showTimeout);
      });
      const durationMs =
        this.audioPlayer.duration * 1000 ||
        song.lyrics[song.lyrics.length - 1].time * 1000 + 4000;
      const hideTimeout = setTimeout(() => {
        this.speechBubble.style.visibility = "hidden";
        this.startWandering();
      }, durationMs + 1000);
      this.lyricTimeouts.push(hideTimeout);
      this.currentMetadataListener = null;
    };

    this.currentMetadataListener = onPlayStart;
    this.audioPlayer.addEventListener("loadedmetadata", onPlayStart, {
      once: true,
    });
    this.audioPlayer.play().catch((e) => {
      this.audioPlayer.removeEventListener("loadedmetadata", onPlayStart);
      this.currentMetadataListener = null;
    });
  }

  startWandering() {
    if (this.wanderInterval) clearInterval(this.wanderInterval);
    this.wanderInterval = setInterval(() => {
      if (!document.getElementById(this.hWnd)) return;
      const desktopRect = wm._desktop.getBoundingClientRect();
      const bonziRect = this.selfWindow.getBoundingClientRect();
      let currentLeft = this.selfWindow.offsetLeft;
      let currentTop = this.selfWindow.offsetTop;
      let dx = (Math.random() - 0.5) * 40;
      let dy = (Math.random() - 0.5) * 20;
      let newLeft = Math.max(
        0,
        Math.min(currentLeft + dx, desktopRect.width - bonziRect.width),
      );
      let newTop = Math.max(
        0,
        Math.min(currentTop + dy, desktopRect.height - bonziRect.height - 30),
      );
      this.selfWindow.style.transition =
        "left 1s ease-in-out, top 1s ease-in-out";
      this.selfWindow.style.left = `${newLeft}px`;
      this.selfWindow.style.top = `${newTop}px`;
    }, 5000);
  }
}

window.BonziLogic = BonziLogic;
}