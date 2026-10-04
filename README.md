# MC桌宠

桌面端是 Tauri 加 three.js。玩家模型、动作和贴图都走原版资源，渲染用
`@bedrock-viewer/model-viewer`。

```shell
cd tauri-pet
npm install
npm run tauri dev
```

[TOC]

## 原版资源

* 模型：`vanilla/player/humanoid.custom.geo.json` 里的
  `geometry.humanoid.custom`。
* 动作：`vanilla/player/player.animation.json` 里的
  `animation.player.move.legs` 和 `animation.player.move.arms`，
  加上 `vanilla/player/humanoid.animation.json` 里的
  `animation.humanoid.bob`。
* 贴图：`assets/minecraft/textures/entity/player/wide/steve.png`。
  窗口里用的是 `tauri-pet/public/vanilla/steve.png` 这份拷贝。

原版动作文件带注释，页面加载时会先去掉注释再交给 model-viewer。
动作骨骼名是 `leftarm` 这种全小写，模型骨骼名是 `leftArm`，启动时会对上。

走路摆臂用的是原版公式：`variable.tcos0` 由移动距离和
`query.modified_move_speed` 算出来，再写进正在播放的动画。

## 桌面网格

窗口铺满主屏幕，点击会穿过它，桌面还能正常用。退出在托盘菜单里。

其他窗口和任务栏是不可走的格子，格子边长 32 像素。
可走的是这些障碍顶上的一层，以及屏幕底边。
桌宠用寻路在这些平台之间走。目标交替为随机格子和托盘图标。
窗口顶上会铺一层草方块和泥土，看起来像横版地图。
