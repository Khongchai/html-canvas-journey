// TODO possible feature:
// Simplify API find a way to simplify things further
// Managed mode, where the lib manages all canvas transformations.
class PetiteTransform {
  /**
   * @type {() => {x: number, y: number, z: number}} `x` is the x offset, `y` the y offset, and `z` the zoom scale.
   */
  #getTransformReference = () => {
    x: 0;
    y: 0;
    z: 0;
  };
  // TODO
  #easeFactor = 1;
  #cumulatedTransform = {
    dx: 0,
    dy: 0,
    dz: 1,
    isSet: false,
    /**
     * Self-explanatory.
     *
     * @type {(x?: number, y?: number, z?: number) => void}
     */
    setTransform: function (x = this.dx, y = this.dy, z = this.dz) {
      this.isSet = true;
      this.dx = x;
      this.dy = y;
      this.dz = z;
    },
    /**
     * Like `setTransform`, but instead of replacing the values, increment them instead.
     *
     * This is to cache all values in-between frames when called from an animation loop.
     *
     * @type {(x?: number, y?: number, z?: number) => void}
     */
    setTransformIncrement: function (x = 0, y = 0, z = 0) {
      this.isSet = true;
      this.dx += x;
      this.dy += y;
      this.dz += z;
    },
    /**
     * Spoonfeed the client only once and then close until more values are set.
     * This is to prevent any translation method in an animation frame from applying the
     * same transform twice. If you need the same transform in multiple places, store it in a variable somewhere.
     *
     * @type {() => {dx: number, dy: number, dz: number}}
     */
    getTransform: function () {
      if (this.isSet) {
        this.isSet = false;
        const returnVal = { dx: this.dx, dy: this.dy, dz: this.dz };
        this.dx = 0;
        this.dy = 0;
        this.dz = 1;

        return returnVal;
      }

      return { dx: 0, dy: 0, dz: 1 };
    },
  };
  #isMouseDown = false;
  #panOffset = {
    prev: {
      x: 0,
      y: 0,
    },
    cur: {
      x: 0,
      y: 0,
    },
  };
  /**
   * @type {{type: string, callback: () => any}[]}
   */
  #listenersRefs = [];

  /**
   *
   * @param {() => number} transformReference a callback that returns the current transform of the canvas.
   * @param {number} easeFactor the t in (a + (b - a) * t) of the linear interpolation equation.
   * @param {number?} devicePixelRatio The device pixel ratio that you set your canvas to. It is
   * vital that this matches what you have set for your canvas.
   */
  constructor(transformReference, easeFactor, devicePixelRatio = 1) {
    this.#easeFactor = easeFactor;
    this.#getTransformReference = transformReference;
    this.#cumulatedTransform.setTransform(0, 0, 1);

    this.#addEventListener("mousedown", (e) => {
      this.#onmousedown({
        x: e.x * devicePixelRatio,
        y: e.y * devicePixelRatio,
      });
    });

    this.#addEventListener("mousemove", (e) => {
      this.#onmousemove({
        x: e.x * devicePixelRatio,
        y: e.y * devicePixelRatio,
      });
    });

    this.#addEventListener("mouseup", (e) => {
      this.#onmouseup({
        x: e.x * devicePixelRatio,
        y: e.y * devicePixelRatio,
      });
    });

    this.#addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();

        this.#onwheel({
          x: e.x * devicePixelRatio,
          y: e.y * devicePixelRatio,
          deltaY: e.deltaY,
        });
      },
      { passive: false }
    );
  }

  /**
   * Call this when you would like to remove all event listeners.
   */
  dispose() {
    this.#listenersRefs.forEach((obj) =>
      document.removeEventListener(obj.type, obj.callback, obj.options)
    );
  }

  /**
   * Returns a change in the transform.
   *
   * Note that if you use a method that resets the transformation matrix
   * like `ctx.setTransform` instead of something like `ctx.transform` or
   * `ctx.translate`, the transformations will not work correctly.
   *
   * @type {() => {dx: number, dy: number, dz: number}}
   */
  get currentTransform() {
    return { ...this.#cumulatedTransform };
  }

  #addEventListener(type, callback, options) {
    document.addEventListener(type, callback, options);
    this.#listenersRefs.add({ type, callback, options });
  }

  /**
   * @param {{x: number, y: number}} e
   */
  #onmousedown(e) {
    this.#isMouseDown = true;
    this.#panOffset.prev.x = e.x - this.#panOffset.cur.x;
    this.#panOffset.prev.y = e.y - this.#panOffset.cur.y;
  }

  #onmouseup() {
    this.#isMouseDown = false;
  }

  /**
   * @param {{x: number, y: number}} e
   */
  #onmousemove(e) {
    if (this.#isMouseDown) {
      const dx = e.x - this.prev.x;
      const dy = e.y - this.prev.y;

      const globalDx = dx / this.#getTransformReference().z;
      const globalDy = dy / this.#getTransformReference().z;
      this.prev.x = e.x;
      this.prev.y = e.y;

      this.#cumulatedTransform.setTransformIncrement(globalDx, globalDy);
    }
  }

  /**
   * @param {{x: number, y: number, deltaY: number}} e
   */
  #onwheel(e) {
    const change = -e.deltaY * 0.0005;
    this.#cumulatedTransform.dz = 1 + change;
    const { x, y, z } = this.#getTransformReference();

    // Grab the world space position of the cursor so that we can calculate
    // later how much to offset the canvas by after zooming.
    const wx = (e.x - x) / z;
    const wy = (e.y - y) / z;

    this.#cumulatedTransform.setTransform(-wx * change, -wy * change);
  }
}
