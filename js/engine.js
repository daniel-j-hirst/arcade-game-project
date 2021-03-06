// The Engine class (significantly changed from the original files)
// handles the underlying procedure of game operation while leaving specific behaviour
// (such as game object rendering, user control and entity interactions) are left to the app script
// to define, allowing for proper separation of concerns.
class Engine {
    // Via the called functions this sets in motion the game loop
    constructor() {
        this.initialiseConstants();
        this.reset(true);
    }

    // Initialises all persistent values and objects that are to remain
    // even after the game is restarted
    initialiseConstants() {
        // Enumeration of valid game states, which control what input is valid and what is rendered
        this.states = Object.freeze({initialising: 0, running: 1, levelWin: 2, gameOver: 3});

        // UI positioning constants
        this.BUTTON_HEIGHT = 50;
        this.BUTTON_WIDTH = 200;
        this.MESSAGE_PADDING = 30;
        this.MESSAGE_BORDER = 10;
        this.INNER_MESSAGE_PADDING = this.MESSAGE_PADDING + this.MESSAGE_BORDER;
        this.INNER_MESSAGE_HEIGHT = 150;
        this.TEXT_Y_OFFSET = 35;
        this.TEXT_LINE2_Y_OFFSET = 63;
        this.BUTTON_Y_OFFSET = 85;
        this.BUTTON_TEXT_OFFSET = 120;

        this.initializeEventListeners();

        // Level factory: while individual levels are reset each time a new level is loaded, the factory itself is persistent.
        this.levels = new Levels();
    }

    // Event listeners for mouse movement/click. Used for clicking Continue/Restart on in-game message boxes
    initializeEventListeners() {
        const that = this;
        document.addEventListener('click', e => that.handleClick(e));
        document.addEventListener('mousemove', e => that.handleMouseMove(e));
    }

    // Resets the level, dependent coordination classes, resources and
    // Set "fullReset" to return to first level and reset score to zero, and false to proceed to next level
    reset(fullReset) {
        this.state = this.states.initialising;
        if (fullReset) {
            this.score = 0;
            this.level = this.levels.reset();
        } else {
            this.level = this.levels.next();
        }
        this.entities = new Entities(this.level);
        this.inputHandler = new InputHandler(this.entities);
        this.lastTime = 0;
        this.timeSinceReset = 0;
        this.buttonHighlight = false;
        this.setupCanvas();
        this.prepareResources();
    }

    // Creates the HTML canvas element and adds it to the DOM
    setupCanvas() {
        this.CANVAS_Y_OFFSET = 55; // transparent area at top of image, enlarge canvas to account for this

        const doc = window.document;
        this.canvas = doc.createElement('canvas');
        const ctx = this.canvas.getContext('2d');

        this.canvas.width = this.level.widthPixels();
        this.canvas.height = this.level.heightPixels() + this.CANVAS_Y_OFFSET;
        // Remove previously created canvas elements, different levels may have different sized canvases so just make a new one
        while (doc.body.firstChild) {
            doc.body.removeChild(doc.body.lastChild);
        }
        doc.body.appendChild(this.canvas);

        // Assign context to a global variable so it can be used in the app file
        window.ctx = ctx;
    }

    // Asks for loading of resources, and asks to start running the main loop once that's done
    prepareResources() {
        const that = this;
        Resources.onReady(() => that.run());
        Resources.load([
            'images/stone-block.png',
            'images/water-block.png',
            'images/grass-block.png',
            'images/enemy-bug.png',
            'images/char-boy.png',
            'images/Gem Green.png'
        ]);
    }

    // Starts running the main loop. This involves some initialisations and then calling
    // the first iteration of the loop (which will then call additional iteration by callbacks)
    run() {
        this.initialiseLevel();
        this.runLoopIteration();
    }

    // Some initial setup including setting the lastTime variable so that the main game loop
    // has an initial value to work with
    initialiseLevel() {
        this.state = this.states.running;
        this.lastTime = Date.now();
    }

    // This is looped over and over to produce the game animation
    runLoopIteration() {
        // Get time taken for the last frame to determine movement distances for entities
        // This doesn't need to be more than 100ms
        // (for debugging purposes there may be very large gaps between frames)
        const dt = Math.min(0.1, this.updateTimer());

        // Pass the change in time to the update function so that the animation can be consisten
        // regardless of screen/browser refresh rate
        this.update(dt);

        this.render();

        // Call on the browser to draw the next frame, then return to this function
        const that = this;
        window.requestAnimationFrame(() => that.runLoopIteration());
    }

    // Keeps track of time per frame so that animations may be displayed smoothly regardless of
    // screen or browser refresh rate. Returns the length of time to process the previous frame
    // in seconds.
    updateTimer() {
        const now = Date.now();
        const dt = (now - this.lastTime) / 1000.0;
        this.lastTime = now;
        return dt;
    }

    // Makes sure this information is consistent everywhere it's used. Player input is disabled
    // for the first few seconds to allow enemies to enter the screen
    playerInputAllowed() {
        return this.timeSinceReset > 2;
    }

    // Determines visibility of the player entity. If player input is disabled then the
    // player entity will "blink" and is periodically not visible
    playerVisible() {
        // Player entity blinks at 2 cycles per second
        const blinkState = Math.floor(this.timeSinceReset * 4 % 2) == 0;
        return this.state != this.states.running || blinkState || this.playerInputAllowed();
    }

    // Function for collective handling the updating of the game state
    // (in particular, movement and iteraction of entities)
    update(dt) {
        this.timeSinceReset += dt;
        if (this.state != this.states.running) return;
        if (this.playerInputAllowed()) this.inputHandler.inputsEnabled = true;
        const entityMessages = this.entities.update(dt);
        if (entityMessages.hitEnemy) {
            this.inputHandler.inputsEnabled = false;
            this.state = this.states.gameOver;
        } else if (entityMessages.levelWon) {
            this.inputHandler.inputsEnabled = false;
            this.state = this.states.levelWin;
        } else if (entityMessages.pickedUpGem) {
            this.score++;
        }
    }

    // Draws the current game level and entities using helper functions
    render() {
        this.renderLevel();
        this.renderEntities();
        this.renderMessages();
    }

    // Draws the background for the current game level
    renderLevel() {
        // Before drawing, clear existing canvas
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let row = 0; row < this.level.heightTiles; row++) {
            for (let col = 0; col < this.level.widthTiles; col++) {
                const fileName = this.level.getTile(row, col);
                ctx.drawImage(Resources.get(fileName), col * this.level.tileWidth, row * this.level.tileHeight);
            }
        }
    }

    // Draws the entities for the current game level
    renderEntities() {
        this.entities.gems.forEach(gem => gem.render());
        if (this.playerVisible()) this.entities.player.render();
        this.entities.enemies.forEach(enemy => enemy.render());
    }

    // These functions keep button positioning consistent between rendering and input handling

    buttonLeft() {
        return (this.canvas.width - this.BUTTON_WIDTH) / 2;
    }

    buttonTop() {
        return this.INNER_MESSAGE_PADDING + this.CANVAS_Y_OFFSET + this.BUTTON_Y_OFFSET;
    }

    buttonRight() {
        return this.buttonLeft() + this.BUTTON_WIDTH;
    }

    buttonBottom() {
        return this.buttonTop() + this.BUTTON_HEIGHT;
    }

    // Renders messages that appear when the player reaches the next level or hits an enemy
    // If there were more UI elements in game it would be good to create separate classes for them
    // but since it's just one box with similar messages just code it here for now
    renderMessages() {
        if (this.state == this.states.running) return;
        if (this.state == this.states.levelWin || this.state == this.states.gameOver) {
            // border
            ctx.fillStyle = '#777';
            ctx.fillRect(this.MESSAGE_PADDING, this.MESSAGE_PADDING + this.CANVAS_Y_OFFSET,
                this.canvas.width - this.MESSAGE_PADDING * 2, this.INNER_MESSAGE_HEIGHT + this.MESSAGE_BORDER * 2);
            // inner area
            ctx.fillStyle = '#BBB';
            ctx.fillRect(this.INNER_MESSAGE_PADDING, this.INNER_MESSAGE_PADDING + this.CANVAS_Y_OFFSET,
                this.canvas.width - this.INNER_MESSAGE_PADDING * 2, this.INNER_MESSAGE_HEIGHT);
            // button
            ctx.fillStyle = (this.buttonHighlight ? '#FFF' : '#DDD');
            ctx.fillRect(this.buttonLeft(), this.buttonTop(), this.BUTTON_WIDTH, this.BUTTON_HEIGHT);
        }

        // message text
        ctx.font = '30px Arial';
        ctx.fillStyle = 'black';
        ctx.textAlign = 'center';
        let messageText = '';
        if (this.state == this.states.gameOver) messageText = 'Game Over!';
        else if (this.state == this.states.levelWin) messageText = 'Level Won!';
        ctx.fillText(messageText, this.canvas.width / 2, this.INNER_MESSAGE_PADDING + this.CANVAS_Y_OFFSET + this.TEXT_Y_OFFSET);

        // button text
        let buttonText = '';
        if (this.state == this.states.gameOver) buttonText = 'Restart';
        else if (this.state == this.states.levelWin) buttonText = 'Continue';
        ctx.fillText(buttonText, this.canvas.width / 2, this.INNER_MESSAGE_PADDING + this.CANVAS_Y_OFFSET + this.BUTTON_TEXT_OFFSET);

        // secondary text
        ctx.font = '20px Arial';
        let secondMessageText = '';
        if (this.state == this.states.gameOver) secondMessageText = `Your score was ${this.score} points!`;
        else if (this.state == this.states.levelWin) secondMessageText = `Your score is ${this.score} points!`;
        ctx.fillText(secondMessageText, this.canvas.width / 2, this.INNER_MESSAGE_PADDING + this.CANVAS_Y_OFFSET + this.TEXT_LINE2_Y_OFFSET);

    }

    // Handler for click events. If the message button is clicked on, this
    // results in progression to next level or game reset, depending on what
    // the message was for
    handleClick(event) {
        const x = event.offsetX;
        const y = event.offsetY;
        if (x >= this.buttonLeft() && x < this.buttonRight() && y >= this.buttonTop() && y < this.buttonBottom()) {
            if (this.state == this.states.gameOver) {
                this.reset(true);
                this.run();
            } else if (this.state == this.states.levelWin) {
                this.reset(false);
                this.run();
            }
        }
    }

    // Handler for mouse move events that may highlight the message box's button
    handleMouseMove(event) {
        const x = event.offsetX;
        const y = event.offsetY;
        if (x >= this.buttonLeft() && x < this.buttonRight() && y >= this.buttonTop() && y < this.buttonBottom()) {
            this.buttonHighlight = true;
        } else {
            this.buttonHighlight = false;
        }
    }
}

// All that is needed now to run the game is to create an engine object, it does the rest
const engine = new Engine();