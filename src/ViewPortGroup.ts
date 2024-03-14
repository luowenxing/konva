import { Util } from './Util';
import { Container, ContainerConfig } from './Container';
import { Konva, _registerNode } from './Global';
import { Node } from './Node';
import { Shape } from './Shape';
import { Factory } from './Factory';


export interface IViewPort {
  viewportX: number;
  viewportY: number;
  viewportW: number;
  viewportH: number;
}
export type ViewPortGroupConfig = ContainerConfig & IViewPort;

/**
 * Group constructor.  Groups are used to contain shapes or other groups.
 * @constructor
 * @memberof Konva
 * @augments Konva.Container
 * @param {Object} config
 * @@nodeParams
 * @@containerParams
 * @example
 * var group = new Konva.Group();
 */
export class ViewPortGroup extends Container<ViewPortGroup | Shape> {
  private reuseViewport: {
    src: IViewPort;
    dst: IViewPort; 
    diff: IViewPort[];
  } | undefined;
  private incrementalDraw: boolean;

  private viewportChildren: (viewport: IViewPort) => Shape[];

  constructor(props) {
    super(props);
    this.viewportChildren = props.viewportChildren;
    this.incrementalDraw = props.incrementalDraw;
  }

  private getViewport() {
    const viewportX = this.viewportX();
    const viewportY = this.viewportY();
    const viewportW = this.viewportW();
    const viewportH = this.viewportH();
    const viewport = { viewportX, viewportY, viewportW, viewportH };
    return viewport;
  }

  moveViewport(deltaX: number, deltaY: number) {
    const viewport = this.getViewport();
    this.reuseViewport = this.incrementalDraw ? Util.calcReuseViewport(viewport, deltaX, deltaY) : undefined;

    Konva.autoDrawEnabled = false;
    this.viewportX(Math.max(0, viewport.viewportX + deltaX));
    this.viewportY(Math.max(0, viewport.viewportY + deltaY));
    Konva.autoDrawEnabled = true;
    this.getLayer()?.draw();
    this.reuseViewport = undefined;
  }


  add(...children: (ViewPortGroup | Shape)[]) {
    Konva.autoDrawEnabled = false;
    const result = super.add(...children);
    Konva.autoDrawEnabled = true;
    return result;
  }

  _validateAdd(child: Node) {
    var type = child.getType();
    if (type !== 'Group' && type !== 'Shape') {
      Util.throw('You may only add shapes to viewport groups.');
    }
  }

  _drawChildren(drawMethod, canvas, top, bufferCanvas?) {
    const viewport = this.getViewport();
    const { viewportX, viewportY, viewportW, viewportH } = viewport;
    var context = canvas && canvas.getContext(),
      clipWidth = this.clipWidth(),
      clipHeight = this.clipHeight(),
      clipFunc = this.clipFunc(),
      hasClip =
        (typeof clipWidth === 'number' && typeof clipHeight === 'number') ||
        clipFunc;

    const { pixelRatio } = canvas;
    const selfCache = top === this;

    if (hasClip) {
      context.save();
      var transform = this.getAbsoluteTransform(top);
      var m = transform.getMatrix();
      context.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
      context.beginPath();
      let clipArgs;
      if (clipFunc) {
        clipArgs = clipFunc.call(this, context, this);
      } else {
        var clipX = this.clipX();
        var clipY = this.clipY();
        context.rect(clipX || 0, clipY || 0, clipWidth, clipHeight);
      }
      context.clip.apply(context, clipArgs);
      m = transform.copy().invert().getMatrix();
      context.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
    }

    var hasComposition =
      !selfCache &&
      this.globalCompositeOperation() !== 'source-over' &&
      drawMethod === 'drawScene';

    if (hasComposition) {
      context.save();
      context._applyGlobalCompositeOperation(this);
    }
    
    const viewports: IViewPort[] = [];
    if (this.reuseViewport) {
      const { diff } = this.reuseViewport;
      viewports.push(...diff);
    } else {
      viewports.push(viewport);
    }
    const children: Shape[] = [];
    const uniqueSet = new Set<Shape>();
    viewports.forEach((vp) => {
      const result = this.viewportChildren(vp);
      result.forEach(child => {
        if (!uniqueSet.has(child)) {
          children.push(child);
          uniqueSet.add(child);
        }
      })
    })

    // clip viewport
    const x = this.x() + viewportX;
    const y = this.y() + viewportY;
    context.save();
    context.beginPath();
    context.rect(x, y, viewportW, viewportH);
    context.clip();

    children.forEach(function (child) {
      child[drawMethod](canvas, top, bufferCanvas);
    });

    if (this.reuseViewport) {
      const { src, dst } = this.reuseViewport;
      if (Util.isValidViewport(src) && Util.isValidViewport(dst)) {
        let { viewportX: srcX, viewportY: srcY, viewportW: srcW, viewportH: srcH } = src;
        let { viewportX: dstX, viewportY: dstY, viewportW: dstW, viewportH: dstH  } = dst;
        // 因为这里的xy已经被override了
        const x = this.x() + viewportX;
        const y = this.y() + viewportY;
        srcX += x;
        dstX += x;
        srcY += y;
        dstY += y;
        const { _cacheCanvas } = canvas;
        context.save()
        context.setTransform(1, 0, 0, 1, 0, 0);
        const srcRect = [srcX * pixelRatio, srcY * pixelRatio, srcW * pixelRatio, srcH * pixelRatio];
        const dstRect = [dstX * pixelRatio, dstY * pixelRatio, dstW * pixelRatio, dstH * pixelRatio];
        context.clearRect(dstRect[0], dstRect[1], dstRect[2], dstRect[3]);
        context.drawImage(_cacheCanvas,
          srcRect[0], srcRect[1], srcRect[2], srcRect[3],
          dstRect[0], dstRect[1], dstRect[2], dstRect[3],
        )
        context.restore();
      }
    }

    if (hasClip) {
      context.restore();
    }

    if (hasComposition) {
      context.restore();
    }

    // restore clip viewport
    context.restore();
    
  }

}
Factory.addGetterSetter(ViewPortGroup, 'viewportX', 0);
Factory.addGetterSetter(ViewPortGroup, 'viewportY', 0);
Factory.addGetterSetter(ViewPortGroup, 'viewportW', 0);
Factory.addGetterSetter(ViewPortGroup, 'viewportH', 0);

Factory.overrideGetter(ViewPortGroup, 'x', 0, function(val) {
  return val - this.viewportX();
});

Factory.overrideGetter(ViewPortGroup, 'y', 0, function(val) {
  return val - this.viewportY();
});

ViewPortGroup.prototype.nodeType = 'Group';
_registerNode(ViewPortGroup);
