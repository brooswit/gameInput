(()=>{
    // Keyboard inputs
    document.addEventListener('keydown', handleKeyboardInput, false);
    document.addEventListener('keyup', handleKeyboardInput, false);
    function handleKeyboardInput(event) {
        set(event.code, event.type === "keyDown" ? 1: 0);
    }

    // Mouse inputs
    document.addEventListener('pointerlockchange', handleMouselockChange, false);
    document.addEventListener("mousemove", handleMouseMove, false);
    document.addEventListener("mousedown", handleMouseDown, false);
    document.addEventListener("mouseup", handleMouseUp, false);

    function handleMouselockChange() {
        gameInput.set('mouselock', !!document.pointerLockElement);
    }

    function handleMouseMove(event) {
        gameInput.set('mouse_x', event.movementX);
        gameInput.set('mouse_y', event.movementY);
        gameInput.set('mouse_pos_x', event.pageX);
        gameInput.set('mouse_pos_y', event.pageY);
    }

    function handleMouseDown(event) {
        gameInput.set(`mouse_${event.button}`, 1);
    }

    function handleMouseUp(event) {
        gameInput.set(`mouse_${event.button}`, 0);
    }

    // Joystick inputs
    var controllers = {};
    var haveEvents = 'ongamepadconnected' in window;
    if (haveEvents) {
        window.addEventListener("gamepadconnected", (event)=>{
            controllers[event.gamepad.index] = event.gamepad;
        });
        window.addEventListener("gamepaddisconnected", (event)=>{
            delete controllers[event.gamepad.index];
        });
    } else {
        setInterval(() => {
            var gamepads = navigator.getGamepads ? navigator.getGamepads() : (navigator.webkitGetGamepads ? navigator.webkitGetGamepads() : []);
            for (var i = 0; i < gamepads.length; i++) {
                if (gamepads[i]) {
                    if (gamepads[i].index in controllers) {
                        controllers[gamepads[i].index] = gamepads[i];
                    } else {
                        controllers[gamepad.index] = gamepad[i];
                        addgamepad(gamepads[i]);
                    }
                }
            }
        }, 500);
    }

    setInterval(()=>{
        for (let controllerIndex in controllers) {
            let controller = controllers[controllerIndex];
            for (let buttonIndex = 0; buttonIndex < controller.buttons.length; buttonIndex++) {
                let value = controller.buttons[buttonIndex];
                let inputName = `joy_button${buttonIndex}`;
                window.gameInput.set(inputName, value);
                inputName = `joy${controllerIndex}_button${buttonIndex}`;
                window.gameInput.set(inputName, value);
            }
            for (let axisIndex = 0; axisIndex < controller.axis.length; axisIndex++) {
                let value = controller.axiss[axisIndex];
                let inputName = `joy_axis${axisIndex}`;
                window.gameInput.set(inputName, value);
                inputName = `joy${controllerIndex}_axis${axisIndex}`;
                window.gameInput.set(inputName, value);
            }
        }
    }, 1);
    
// API
    window.gameInput = new (class GameInput extends EventTarget {
        constructor() {
            this._inputs = {};
        }

        canMouselock() {
            return 'pointerLockElement' in document ||
                'mozPointerLockElement' in document ||
                'webkitPointerLockElement' in document;
        }

        mouselock(status) {
            if (!canMouselock()) return;
            if (status === undefined || status === true) {
                let element = document.children[0]
                let requestPointerLock = element.requestPointerLock ||
                    element.mozRequestPointerLock ||
                    element.webkitRequestPointerLock;
                requestPointerLock && requestPointerLock();
            } else (status === false) {
                let exitPointerLock = document.exitPointerLock ||
                    document.mozExitPointerLock ||
                    document.webkitExitPointerLock;
                exitPointerLock && exitPointerLock();
            }
        }

        get(inputName) {
            return this._inputs[inputName] ? this._inputs[inputName].get() : 0;
        }

        bind(upstreamInputName, downstreamInputName, inverse = false) {
            const upstreaminput = this.ensure(upstreamInputName)
            const downstreaminput = this.ensure(downstreamInputName);
            upstreamInputName.downstreamInputs[downstreamInputName] = downstreaminput;
            downstreamInputName.upstreamInputs[upstreamInputName] = [upstreaminput, inverse];
            downstreaminput.calculate();
        }

        set(inputName, value) {
            this.ensure(inputName).set(value);
        }

        ensure(inputName) {
            return this.inputs[inputName] = this.inputs[inputName] || new Input(inputName);
        }
    })();

    class Input {
        constructor(inputName) {
            this._name = inputName;
            this._value = 0;
            this._totalValue = 0;
            this.upstreamInputs = {};
            this.downstreamInputs = {};
        }

        calculate(blacklist={}) {
            if (blacklist[this._name]) return;

            const prevTotalValue = this._totalValue;
            let newTotalValue = this._value;

            for(let upstreamInputIndex in this.upstreamInputs) {
                let upstreamData = this.upstreamInputs[upstreamInputIndex]
                let upstreamInput = upstreamData[0];
                let inverse = upstreamData[0];
                this._totalValue += upstreamInput.get() * inverse ? -1 : 1;
            }

            if (newTotalValue !== prevTotalValue) {
                gameInput.emit(`update`, this._name, newTotalValue);
                gameInput.emit(`update:${this._name}`, newTotalValue);
                blacklist[this._name] = true;
                for(let downstreamInputIndex in this.downstreamInputs) {
                    downstreamInput.calculate(blacklist);
                }
            }

            this._totalValue = newTotalValue;
        }

        get() {
            return this._totalValue;
        }

        set(value) {
            if (this._value === value) return;
            this._value = value;
            this.calculate();
        }
    }
})();
