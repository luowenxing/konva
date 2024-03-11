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

  private viewportChildren: (viewport: IViewPort) => Shape[];

  constructor(props) {
    super(props);
    this.viewportChildren = props.viewportChildren;
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
    this.reuseViewport = Util.calcReuseViewport(viewport, deltaX, deltaY);

    console.log(`reuseViewport: ${JSON.stringify(this.reuseViewport)}`)

    Konva.autoDrawEnabled = false;
    this.viewportX(viewport.viewportX + deltaX);
    this.viewportY(viewport.viewportY + deltaY);
    Konva.autoDrawEnabled = true;
    this.getLayer()?.draw();
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
    var context = canvas && canvas.getContext(),
      clipWidth = this.clipWidth(),
      clipHeight = this.clipHeight(),
      clipFunc = this.clipFunc(),
      hasClip =
        (typeof clipWidth === 'number' && typeof clipHeight === 'number') ||
        clipFunc;

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
    
    const viewport = this.getViewport();
    const viewports: IViewPort[] = [];
    if (this.reuseViewport) {
      const { diff } = this.reuseViewport;
      viewports.push(...diff);
    } else {
      viewports.push(viewport);
    }
    const children: Shape[] = [];
    viewports.forEach((vp) => {
      const result = this.viewportChildren(vp);
      children.push(...result);
    })

    children?.forEach(function (child) {
      child[drawMethod](canvas, top, bufferCanvas);
    });
    if (hasComposition) {
      context.restore();
    }

    if (hasClip) {
      context.restore();
    }

    if (this.reuseViewport) {
      const { src, dst } = this.reuseViewport;
      const { viewportX: srcX, viewportY: srcY, viewportW: srcW, viewportH: srcH } = src;
      const { viewportX: dstX, viewportY: dstY, viewportW: dstW, viewportH: dstH  } = dst;
      const { _cacheCanvas, pixelRatio } = canvas;
      context.save()
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.drawImage(_cacheCanvas,
        srcX * pixelRatio, srcY * pixelRatio, srcW * pixelRatio, srcH * pixelRatio,
        dstX * pixelRatio, dstY * pixelRatio, dstW * pixelRatio, dstH * pixelRatio,
      )
      context.restore();
      this.reuseViewport = undefined;
    }
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
