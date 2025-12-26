import { Util } from './Util';
import { Container, ContainerConfig } from './Container';
import { _registerNode } from './Global';
import { Node } from './Node';
import { Shape } from './Shape';
import { Factory } from './Factory';
import { GetSet } from './types';
import { Group } from './Group';


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
export class ViewPortGroup extends Container<Group | Shape> {
  private reuseViewport: {
    src: IViewPort;
    dst: IViewPort; 
    diff: IViewPort[];
  } | undefined;
  private incrementalDraw: boolean;
  private cacheDelta = { deltaX: 0, deltaY: 0 };
  private waitForDraw = false;
  private cacheCanvasValid = false;

  public viewportX: GetSet<number, this>;
  public viewportY: GetSet<number, this>;
  public viewportW: GetSet<number, this>;
  public viewportH: GetSet<number, this>;


  private viewportChildren: (viewport: IViewPort[]) => Shape[];

  constructor(props: ViewPortGroupConfig) {
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

  private supportIncrementalDraw(drawMethod: string) {
    const layer = this.getLayer();
    const layerSupport = layer.attrs.incrementalDraw;
    return layerSupport && drawMethod === 'drawScene' && this.reuseViewport && this.cacheCanvasValid && this.incrementalDraw;
  }

  clearCache(clearCavasCache = false) {
    this.cacheDelta = { deltaX: 0, deltaY: 0 };
    if (clearCavasCache) {
      // 有时候，我们希望强制重绘，不复用上次的canvas缓存，可以这样设置
      this.cacheCanvasValid = false;
    }
    return super.clearCache();
  }

  moveViewport(deltaX: number, deltaY: number) {
    const layer = this.getLayer();
    this.cacheDelta.deltaX += (deltaX);
    this.cacheDelta.deltaY += (deltaY);
    
    if (!this.waitForDraw) {
      this.waitForDraw = true;

      const clearAfterDraw = () => {
        this.reuseViewport = undefined;
        this.waitForDraw = false;
        this.cacheDelta = { deltaX: 0, deltaY: 0 };
        // 绘制之后，重置为true
        this.cacheCanvasValid = true;
        layer.off('beforeDraw', beforeDraw);
        layer.off('draw', clearAfterDraw);
      };

      const beforeDraw = () => {
        const { deltaX, deltaY } = this.cacheDelta;
        const viewport = this.getViewport();
        this.reuseViewport = Util.calcReuseViewport(viewport, deltaX, deltaY);
    
        this.attrs.viewportX = Math.max(0, viewport.viewportX + deltaX);
        this.attrs.viewportY = Math.max(0, viewport.viewportY + deltaY);
        this.clearCache();
      };

      layer.on('beforeDraw', beforeDraw);
      layer.on('draw', clearAfterDraw);
      layer.batchDraw();
    }
  }

  _validateAdd(child: Node) {
    var type = child.getType();
    if (type !== 'Group' && type !== 'Shape') {
      Util.throw('You may only add shapes to viewport groups.');
    }
  }

  _drawChildren(drawMethod, canvas, top, bufferCanvas?) {
    const supportIncrementalDraw = this.supportIncrementalDraw(drawMethod);
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
    if (supportIncrementalDraw) {
      const { diff } = this.reuseViewport;
      viewports.push(...diff);
    } else {
      viewports.push(viewport);
    }
    const children: Shape[] = [];
    const uniqueSet = new Set<Shape>();
    const result = this.viewportChildren(viewports);
    result.forEach(child => {
      if (!uniqueSet.has(child)) {
        children.push(child);
        uniqueSet.add(child);
      }
    });

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

    if (supportIncrementalDraw) {
      const { src, dst } = this.reuseViewport;
      if (Util.isValidViewport(src) && Util.isValidViewport(dst)) {
        let { viewportX: srcX, viewportY: srcY, viewportW: srcW, viewportH: srcH } = src;
        let { viewportX: dstX, viewportY: dstY, viewportW: dstW, viewportH: dstH  } = dst;
        // 因为这里的xy已经被override了
        const x = this.attrs.x;
        const y = this.attrs.y;
        srcX += x;
        dstX += x;
        srcY += y;
        dstY += y;
        const { _cacheCanvas } = canvas;
        context.save()
        context.setTransform(1, 0, 0, 1, 0, 0);

        const xMethod = srcX - dstX > 0 ? Math.floor : Math.ceil;
        const yMethod = srcY - dstY > 0 ? Math.floor : Math.ceil;

        const srcRect = [xMethod(srcX * pixelRatio), yMethod(srcY * pixelRatio), Math.floor(srcW * pixelRatio), Math.floor(srcH * pixelRatio)];
        const dstRect = [xMethod(dstX * pixelRatio), yMethod(dstY * pixelRatio), Math.floor(dstW * pixelRatio), Math.floor(dstH * pixelRatio)];

        for (const i of [...srcRect, ...dstRect]) {
          if (!Number.isInteger(i)) {
            throw new Error(`${i} is not integer`);
          }
        }

        // 用clip 限制clear 区域，防止clear 在有小数的时候，影响颜色
        context.rect(dstRect[0], dstRect[1], dstRect[2], dstRect[3]);
        context.clip();
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
