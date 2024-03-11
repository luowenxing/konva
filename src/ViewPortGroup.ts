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
  private diffViewport: IViewPort | undefined;
  private reuseViewport: {
    src: IViewPort;
    dst: IViewPort; 
  } | undefined;

  private viewportChildren: (viewport: IViewPort) => Shape[];

  constructor(props) {
    super(props);
    this.viewportChildren = props.viewportChildren;
  }

  moveViewport(deltaX: number, deltaY: number) {
    const viewportX = this.viewportX();
    const viewportY = this.viewportY();
    const viewportW = this.viewportW();
    const viewportH = this.viewportH();

    if (deltaX > 0) {
      this.diffViewport = {
        viewportX: viewportX + viewportW,
        viewportY,
        viewportW: Math.abs(deltaX),
        viewportH: viewportH,
      };
    } else if (deltaX < 0) {
      this.diffViewport = {
        viewportX: viewportX - Math.abs(deltaX),
        viewportY,
        viewportW: Math.abs(deltaX),
        viewportH: viewportH,
      };
    }
    if (deltaY > 0) {
      this.diffViewport = {
        viewportX,
        viewportY: viewportY + viewportH,
        viewportW: viewportW,
        viewportH: Math.abs(deltaY),
      }
    } else if (deltaY < 0) {
      this.diffViewport = {
        viewportX,
        viewportY: viewportY - Math.abs(deltaY),
        viewportW: viewportW,
        viewportH: Math.abs(deltaY),
      }
    }

    this.reuseViewport = Util.makeReuseViewport(viewportW, viewportH, deltaX, deltaY);

    console.log(`diffViewport: ${JSON.stringify(this.diffViewport)}`)
    console.log(`reuseViewport: ${JSON.stringify(this.reuseViewport)}`)

    Konva.autoDrawEnabled = false;
    this.viewportX(viewportX + deltaX);
    this.viewportY(viewportY + deltaY);
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
    
    const viewport = this.diffViewport || {
      viewportX: this.viewportX(),
      viewportY: this.viewportY(),
      viewportW: this.viewportW(),
      viewportH: this.viewportH(),
    }
    const children = this.viewportChildren ? this.viewportChildren(viewport) : this.children;

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
      const { _cacheCanvas } = canvas;
      context.save()
      context.setTransform(1, 0, 0, 1, 0, 0);
      const pixel = 2;
      context.drawImage(_cacheCanvas,
        srcX * pixel, srcY * pixel, srcW * pixel, srcH * pixel,
        dstX * pixel, dstY * pixel, dstW * pixel, dstH * pixel,
      )
      context.restore();
      this.reuseViewport = null;
      this.diffViewport = null;
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
