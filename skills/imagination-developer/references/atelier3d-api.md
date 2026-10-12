# Atelier3D 1.0.1：可选的本地三维基础资源

这是一份可选资产的接口说明，不是必须采用的艺术风格或框架。文件位于 ../assets/atelier3d.js。
成熟库更适合复杂透明材质、后期效果、加载器或高级动画时，应选择合适的库并随包交付。
本库不自动提供题材几何、内容、产品交互或全局光照，不能代替创作判断。

## 导航
- 核心约定、最小场景与内嵌方式
- Renderer / frame 与原生证据范围
- 几何、对象、材质
- 场景、相机、灯光和环境
- 数学、标注与 Orbit
- 已验证范围与 1.0.1 阴影修订


文件：assets/atelier3d.js
定位：共享的三维绘制技术资源。既能在普通 HTML 的 <script> 内完整内嵌，也能在 Node 中 require。没有第三方依赖、CDN、模块加载器或安装步骤。库在加载时不读取 DOM；只有 new Renderer(canvas) 与 new Orbit(canvas,camera) 使用浏览器对象。

核心约定
--------

const A = globalThis.Atelier3D;                 // 普通 script
const A = require('./atelier3d.js');            // Node

世界坐标：右手系，+Y 朝上，距离单位由作品自行决定。
矩阵：column-major，列向量，最终位置 = projection * view * model * position。
旋转：弧度；唯一的角度例外为 camera.fov，使用度。
时间：frame/render 的 time 使用秒，不是毫秒。
颜色：'#RGB'、'#RRGGBB' 或 [r,g,b]，数组分量也是 0–1 sRGB。
材质颜色进入着色前转线性空间，结果经过 filmic 色调映射和 sRGB 编码。
不支持 CSS 命名色、rgba() 或 CSS 变量作为颜色值。

最小场景
--------

const scene = {
  camera: {
    position: [5, 3.5, 6],
    target: [0, 0.8, 0],
    fov: 42,
    near: 0.05,
    far: 100
  },
  background: '#e6e0d5',
  light: {
    direction: [-3, 7, 5],
    intensity: 3.2,
    shadowExtent: 5,
    shadowSize: 1024
  },
  objects: [
    {
      geometry: A.plane(12, 10),
      material: {color:'#b8ad9d', roughness:0.95},
      castShadow: false
    },
    {
      geometry: A.sphere(1),
      material: {color:'#c39245', roughness:0.22, metalness:1},
      model: A.compose({position:[0,1,0]})
    }
  ]
};

const renderer = new A.Renderer(document.querySelector('canvas'));
const orbit = new A.Orbit(renderer.canvas, scene.camera);
function loop(milliseconds) {
  renderer.render(scene, milliseconds / 1000);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

静态场景可以只在输入或相机变化后 render，不需要永远运行循环。Orbit 的 options.onChange 可调用重绘函数。动效作品仍需自己处理减少动态效果偏好与可见状态。

HTML 的内嵌方式
--------------

把 atelier3d.js 的完整原文放入一个普通 <script>...</script>；在后续 script 中定义场景与控件。不要改成 type="module"，也不必保留第二份外部脚本。库自身不包含闭合 script 字符串。生成页面时不要手动复制后再独立修改着色器；技术代码发生修正后重新内嵌。

Renderer 与 frame
-----------------

new A.Renderer(canvas, options?)
options:
  autoResize: true（默认）；按 canvas.clientWidth/clientHeight 设置绘制尺寸。
  pixelRatio: 默认 min(devicePixelRatio, 2)。
  preserveDrawingBuffer: false（默认）；只有确实需要 canvas 读回时设置 true。

WebGL context 固定 alpha:false、antialias:false、premultipliedAlpha:false，
与当前单采样离屏 RGBA8 路径的边界保持清楚。没有自动降级成另一个近似渲染器。

renderer.render(scene, timeSeconds=0)
  构造 A.frame(scene, canvas.width, canvas.height, time)，然后直接 drawFrame。
  返回本次完整 frame 包，同时放在 renderer.lastFrame。

renderer.drawFrame(packet)
  直接执行包中的 shader、attributes、indices、uniforms、textures 和 passes。
  不重新解释题材或材质，也不替换 shader。

renderer.resize(cssWidth, cssHeight, pixelRatio=1)
  手动设置绘制尺寸并关闭自动尺寸跟踪。需要时继续调用 resize。

renderer.dispose()
  删除当前持有的程序、几何缓冲、纹理、FBO 与深度缓冲。

GPU 几何缓存依赖 geometry.id、对象引用和 geometry.version。
直接修改顶点/法线数组后调用 A.touch(geometry)。
也允许以新几何替换 object.geometry；不在当前帧中的 GPU 几何会被回收。
静态几何应只建一次并复用；不要在每帧无意义地重建所有球体和盒子。

A.frame(scene, width, height, timeSeconds=0)
  无 DOM，返回可直接 JSON.stringify 的 native-scene-frame-v1 包。
  主体和阴影使用同一份几何、模型矩阵与裁剪平面。
  scene 或 object 的 geometry/material/model/visible 可为 time => value 函数；
  函数在导出时求值，实际 frame 内不包含函数。

Frame schema 与 native 执行器完全一致：
  programs[id] = {vertex, fragment}
  geometries[id] = {
    attributes: {aPosition:{size:3,data:[...]}, aNormal:{size:3,data:[...]}},
    indices:[...], indexType:'uint16'
  }
  uniforms[name] = {type:'mat4'|'mat3'|'vec4'|'vec3'|'vec2'|'float'|'int', value:...}
  textures[id] 描述 RGBA8 纹理或有 DEPTH_COMPONENT16 深度缓冲的渲染目标。
  passes 按顺序执行，draw 的 uniform、texture 与绘制状态覆盖 pass 的值。

Native 导出与证据边界
-------------------
A.frame 返回无 DOM 的渲染包，可作为绘制状态的独立记录。本轮完整作品包的“技术复现”另提供原生 EGL/GLES 重放脚本与格式说明；它们不是浏览器运行前提，也不在此技能中强制要求。
若使用原生重放，只能据此判断几何、着色器、材质和相机，不可声称 HTML 排版、事件或 file:// 冷启动已完成验收。有允许的浏览器时应直接检验最终作品。

几何
----

A.box(width=1, height=1, depth=1)
  中心位于原点，六个平面有分开的顶点和面法线。

A.plane(width=1, depth=1, nx=1, nz=1, heightFunction?)
  水平 XZ 平面，y=0，正面朝 +Y。nx/nz 是细分数。
  heightFunction(x,z,column,row) -> y 可生成真实地形；法线按网格计算。
  没有 heightFunction 时所有法线严格朝上。

A.sphere(radius=1, segments=40, rings=24)
  经度 segments、纬度 rings；法线平滑，避开重复极点退化三角形。

A.cylinder(radiusTop=0.5, radiusBottom=radiusTop, height=1, segments=40, capped=true)
  Y 轴为轴心，中心在原点，顶面 y=height/2。
  顶部半径为 0 可生成锥体；封顶面与侧面拥有独立法线。

A.torus(majorRadius=1, minorRadius=0.22, radialSegments=16, tubularSegments=64, arc=2*PI)
  主环位于 XZ 平面，Y 轴穿过环心。
  arc 小于整圈时为开放环段，端部不自动封口。

A.lathe([[radius,y], ...], segments=48)
  绕 Y 轴旋转剖面。外壁剖面应从下向上走，以获得朝外法线。
  空心器皿可以按外底 -> 外壁向上 -> 圆唇 -> 内壁向下 -> 内底 -> 底面排列。
  端点 radius=0 可闭合到轴心；不会自动添加用户没有给出的底面/顶盖。
  尖锐折线需要在折点放两个相同位置的剖面点，分别保留折点两侧斜率。
  极轴位置可能存在无面积退化三角形，不影响绘制或深度，但不是非流形实体验证。

A.tube(points, radius=0.05, sides=10, options?)
  points 为 [[x,y,z], ...]，沿路径维护连续截面框架。
  radius 可为 (normalizedProgress,index) => radius。
  options.caps 默认 true；options.closed:true 用于首尾重合的闭环，
  此时要把第一个点在数组末尾再列一次。闭环不封口。
  路径若过粗、自相交或弯曲半径小于管径，不会自动修复几何。

A.triangles(positions, indices?, normals?)
  positions/normals 可以是平铺数字数组，也可以是 [[x,y,z], ...]。
  indices 省略时按连续三顶点组成一个三角形。
  normals 省略时根据三角面累加并归一化；共享索引会平滑法线。
  需要硬边时使用分开的顶点或提供明确法线。
  输出的正面绕序为 CCW，每个网格最多 65535 顶点，不依赖 Uint32 扩展。

A.touch(geometry)
  增加版本号，通知 Renderer 重新上传被原地修改的顶点和法线。

对象
----

{
  name: '用于帧报告的名称',
  geometry: mesh,
  material: material,
  model: A.compose(...),              // 不提供时使用以下三个字段
  position: [x,y,z],
  rotation: [rx,ry,rz],
  scale: 1 或 [sx,sy,sz],
  visible: true,
  castShadow: true,
  receiveShadow: true,
  doubleSided: false,
  clipPlane: [nx,ny,nz,d]
}

裁剪平面使用世界坐标。保留 dot([worldX,worldY,worldZ,1],plane) >= 0 的部分。
主体和阴影同时裁剪；截面不会自动封盖，作品需要时须提供真实截面几何。
请用 visible:false 隐藏对象，不要依赖零缩放的退化面。

材质
----

{
  color: '#c5a24d',
  roughness: 0.45,                   // 0.055–1；内部限制极端奇点
  metalness: 0,                      // 0–1
  emission: 0,                      // 数字乘当前基色，或独立颜色
  texture: 'none',                  // none / wood / ceramic / rock / water
  textureScale: 1,
  textureStrength: 1,
  opacity: 1,
  unlit: false,
  ao: 1,
  doubleSided: false
}

颜色、粗糙度、金属度控制实际 GGX/Schlick/Smith 光照，不只是换配色。
wood：对象局部坐标中的木纹、年轮与细丝，附着于几何，随对象移动和旋转。
ceramic：细微颗粒与粗糙度变化；适合让器形与釉面高光承担主体。
rock：多尺度色差、纹理法线与较高粗糙度；没有改变几何外轮廓。
water：随时间移动的程序法线与颜色变化；不是流体求解或自动波面位移。
textureScale 以对象局部坐标计；模型缩放也会缩放该材料的纹理外观。
这些程序材料是可选的造型手段，不能代替作品所需的真实结构和细节。

opacity<1 使用普通 alpha blending，按对象原点到相机的距离排序。
这不是折射玻璃模型，交叠透明对象仍有排序局限。
opacity<0.95 的对象默认不投射实心阴影，castShadow:true 可显式覆盖。
unlit:true 保留颜色与 emission，跳过直接/环境光和 filmic 曲线，仍可受雾影响。
ao 是手工给定的环境遮蔽权重；库没有宣称计算全局光照或屏幕空间 AO。

场景、相机、灯光与环境
----------------------

new A.Scene(options) 与普通 scene 对象等价；只提供合理默认值。
objects 是可变数组，多个对象可以共享同一 geometry 和 material。

camera:
  position/eye: [x,y,z]，position 优先。
  target: [x,y,z]，默认 [0,0,0]。
  up: 默认 [0,1,0]。
  fov: 默认 42 度，使用透视投影。
  near/far: 默认 0.05/150，要求 0 < near < far。
  ortho: 数字时改为正交相机，数值代表可见区域的垂直世界尺寸。

background:
  可以是单色，或 {top:'#...', bottom:'#...', vignette:0}。
  默认不加暗角；gradient 在实际 WebGL pass 中绘制，不依赖 CSS 替身。

light:
  direction: 从 target 指向光源的方向，不要求单位向量。
  target: 阴影区域中心，默认 [0,0,0]。
  color: 默认 '#fff4e4'。
  intensity: 默认 3.2。
  shadows: 默认 true。
  shadowSize: 默认 1024，允许 64–4096；不保证所有设备都能分配最大尺寸。
  shadowExtent: 默认 8，是正交阴影视域的半宽与半高。
  shadowDistance: 默认 max(12,shadowExtent*3)。
  shadowNear: 默认 0.1。
  shadowFar: 默认 shadowDistance+shadowExtent*3。
  shadowBias: 默认由阴影世界像素尺寸和深度范围计算，并按表面迎光角调整。
  shadowSoftness: 默认 1.25，控制 4×4 PCF 的采样间距，单位为影图像素。
  shadowStrength: 默认 1。
  阴影 pass 使用 polygonOffset:{factor:1.5,units:2}。

合理缩紧 shadowExtent 会提高有效阴影分辨率。
若阴影区域发生截断，调整 target/extent/near/far；不要单靠加大偏移掩盖问题。
若出现明显 acne，先检查几何法线、薄面、重叠面和光照空间范围，再小幅调整 bias。
阴影是方向光投影图的 PCF 近似，不是面积光源路径追踪。

environment:
  sky: 默认 '#b8c4d5'。
  ground: 默认 '#615951'。
  intensity: 默认 0.75。
  studio: 默认 true；解析计算宽柔光箱、窄反光条与顶部光源的反射。
  不需要环境贴图、立方纹理或联网资源。粗糙度会扩散并减弱反射。
  studio:false 保留半球环境光，但关闭影棚反射源。

fog:
  color: 默认使用背景下部颜色。
  density: 默认 0，指数距离雾。
  heightFalloff: 默认 0；大于 0 时让高处雾量减少。

scene.exposure: 默认 1.05。

数学与标注
----------

A.compose({position,rotation,scale})
  返回 T * Rz * Ry * Rx * S；先局部缩放，再 X/Y/Z 旋转，最后平移。

A.mat4.identity / multiply / translation / scaling
A.mat4.rotationX / rotationY / rotationZ
A.mat4.lookAt / perspective / orthographic
A.mat4.normalMatrix(model)
  逆转置 3×3，非均匀缩放下保留法线与切线的垂直关系。
A.mat4.transformPoint(matrix,[x,y,z])

A.cameraMatrices(camera,aspect)
  返回 view、projection、viewProjection、eye、target。

A.project([x,y,z],camera,width,height)
  返回 {x,y,z,visible}，x/y 是从左上角计的绘制像素，z 为 NDC 深度。
  visible 检查视锥和相机前后，不执行场景几何遮挡查询。
  用 CSS 覆盖标签时先把绘制像素换算为 CSS 像素。

A.vec3.add/sub/scale/dot/cross/length/normalize
A.clamp(value,min,max)
A.color(value) / A.linearColor(value)

Orbit
-----

new A.Orbit(canvas,camera,{
  onChange: () => redraw(),
  minDistance:0.5, maxDistance:150,
  minPhi:0.06, maxPhi:Math.PI-0.06,
  rotateSpeed:1, zoomSpeed:1
})

鼠标/单指拖动旋转；滚轮和双指间距缩放。camera 被原地更新。
orbit.rotate(yawRadians,pitchRadians)
orbit.zoom(distanceFactor)
orbit.reset()
orbit.sync()      // 外部改变 camera 后重新读取
orbit.dispose()

reset 恢复初始相机位置、目标和正交尺寸。作品需另外提供按钮或数值替代；
库不会把相机帮助器当作完整可访问交互设计。

已验证与未验证
--------------

本轮完整包中的技术记录核对了几何绕序、法线、相机投影、矩阵与 JSON 包，并将实际场景交由原生 EGL/GLES 编译和出图。
Node 数学检查不等于浏览器交互验证；EGL 出图也不等于 DOM/CSS/file:// 验收。
应把这些技术证据与每件作品自己的功能、内容、设备范围检验分开记录。


1.0.1 修订
----------
修复 RGBA8 阴影深度打包的 255/256 归一化比例。pack 输出乘256/255，
unpack点积乘255/256，避免归一化8位通道与256进制权重的不一致造成
大面积三角自阴影。独立量化记录保留在本轮完整作品包的证据中，并在
06-optics、04-pottery、01-lightroom 实际场景中重新渲染。
