import { _decorator, Component, Node, Label, Button, Sprite, SpriteFrame, tween, Vec3, log, warn, error, Prefab, instantiate, UITransform, director, Tween, AudioSource } from 'cc';
import { Cow } from './cow';
const { ccclass, property } = _decorator;

@ccclass('Main')
export class Main extends Component {
    @property(Node)
    buttonNode: Node = null!;

    @property(SpriteFrame)
    buttonOnSprite: SpriteFrame = null!; // 按下的图片

    @property(SpriteFrame)
    buttonOffSprite: SpriteFrame = null!; // 松开的图片

    @property(Node)
    ropeNode: Node = null!;

    @property(Node)
    cowNode: Node = null!;

    @property(Prefab)
    cowPrefab: Prefab = null!;

    @property(Label)
    score: Label = null!;

    @property(Label)
    time: Label = null!;

    @property({ type: [SpriteFrame], displayName: "Rope Sprites" })
    robeSprites: SpriteFrame[] = [];

    @property(Node)
    resultNode: Node = null!;

    @property(AudioSource)
    bgMusic: AudioSource = null!;

    // 动画进行中的标记
    private isAnimating: boolean = false;
    // 分数
    private scoreValue: number = 0;
    // 时间（秒）
    private timeValue: number = 20;
    // 计时器累加器
    private timeAccumulator: number = 0;
    // 当前绳索样式索引
    private currentRopeIndex: number = 0;
    // 游戏是否结束
    private isGameOver: boolean = false;
    // 当前场景名称（在 start 时保存）
    private currentSceneName: string = "";
    // 是否正在重启游戏
    private isRestarting: boolean = false;

    start() {
        log("游戏开始");
        
        // 保存当前场景名称
        const scene = director.getScene();
        if (scene && scene.name) {
            this.currentSceneName = scene.name;
            log(`当前场景名称: ${this.currentSceneName}`);
        } else {
            // 如果获取不到场景名称，从 URL 中获取或使用默认值
            this.currentSceneName = "main";
            warn(`无法获取场景名称，使用默认值: ${this.currentSceneName}`);
        }
        
        // 初始化游戏状态
        this.isGameOver = false;
        this.isRestarting = false;
        
        // 初始化分数和时间显示
        this.updateScore();
        this.updateTime();
        
        // 初始化绳索样式为0
        this.updateRopeSprite(0);
        
        // 播放背景音乐
        if (this.bgMusic && !this.bgMusic.playing) {
            this.bgMusic.play();
            log("🎵 背景音乐开始播放");
        }
        
        // 绑定按钮事件
        if (this.buttonNode) {
            // 按下事件
            this.buttonNode.on(Node.EventType.TOUCH_START, this.onButtonPressed, this);
            // 松开事件（点击完成）
            this.buttonNode.on(Node.EventType.TOUCH_END, this.onButtonClicked, this);
            // 取消事件（手指移出按钮范围）
            this.buttonNode.on(Node.EventType.TOUCH_CANCEL, this.onButtonCancel, this);
        } else {
            error("⚠️ buttonNode 未设置！");
        }
    }

    /**
     * 按钮按下时的回调
     */
    onButtonPressed() {
        // 切换按钮图片为按下状态
        if (this.buttonNode && this.buttonOnSprite) {
            const sprite = this.buttonNode.getComponent(Sprite);
            if (sprite) {
                sprite.spriteFrame = this.buttonOnSprite;
            }
        }
    }

    /**
     * 按钮点击完成时的回调（松开）
     */
    onButtonClicked() {
        // 如果游戏已结束，不响应点击
        if (this.isGameOver) {
            return;
        }
        
        // 切换按钮图片为松开状态
        if (this.buttonNode && this.buttonOffSprite) {
            const sprite = this.buttonNode.getComponent(Sprite);
            if (sprite) {
                sprite.spriteFrame = this.buttonOffSprite;
            }
        }
        
        // 如果动画正在进行中，阻止新的点击
        if (this.isAnimating) {
            return;
        }
        
        // 点击时触发 rope 弹出动画
        if (this.ropeNode) {
            // 标记动画开始
            this.isAnimating = true;
            this.updateRopeSprite(0);
            
            // 停止之前的动画（防止意外情况）
            tween(this.ropeNode).stop();
            
            // 设置起始位置并显示
            this.ropeNode.setPosition(this.ropeNode.position.x, -600, 0);
            this.ropeNode.active = true;
            
            // 将绳索设置到最高层
            if (this.ropeNode.parent) {
                this.ropeNode.setSiblingIndex(this.ropeNode.parent.children.length - 1);
            }
            
            // 创建移动动画（弹出）
            tween(this.ropeNode)
                .to(0.5, { position: new Vec3(this.ropeNode.position.x, -100, 0) })
                .call(() => {
                    // 绳子到达顶端，检测是否捕获到牛
                    this.checkCaptured();
                })
                // 弹出完成后自动回缩
                .to(0.5, { position: new Vec3(this.ropeNode.position.x, -600, 0) })
                .call(() => {
                    // 回缩动画结束后隐藏绳子
                    this.ropeNode.active = false;
                    // 标记动画结束
                    this.isAnimating = false;
                })
                .start();
        } else {
            error("⚠️ ropeNode 未设置！");
        }
    }

    /**
     * 按钮取消时的回调（手指移出按钮范围）
     */
    onButtonCancel() {
        // 切换按钮图片为松开状态
        if (this.buttonNode && this.buttonOffSprite) {
            const sprite = this.buttonNode.getComponent(Sprite);
            if (sprite) {
                sprite.spriteFrame = this.buttonOffSprite;
            }
        }
    }

    /**
     * 检测是否捕获到牛
     */
    checkCaptured() {
        // 如果游戏已结束，不进行检测
        if (this.isGameOver) {
            return;
        }
        
        if (this.ropeNode && this.cowNode && this.cowNode.isValid) {
            // 获取rope和cow的水平位置
            const ropeX = this.ropeNode.position.x;
            const cowX = this.cowNode.position.x;
            
            // 计算水平距离差
            const distance = cowX - ropeX;
            
            log(`检测捕获：绳索X=${ropeX.toFixed(0)}, 牛X=${cowX.toFixed(0)}, 距离=${distance.toFixed(0)}`);
            
            // 判断距离是否在-50到50之间
            if (distance >= -50 && distance <= 50) {
                log("🎉 捕获成功！");
                // 增加分数
                this.scoreValue++;
                this.updateScore();
                
                // 获取牛的类型并切换绳索样式
                const cowComponent = this.cowNode.getComponent(Cow);
                if (cowComponent) {
                    const cowType = cowComponent.getCowType();
                    this.updateRopeSprite(cowType);
                    log(`绳索样式切换为类型: ${cowType}`);
                }

                // 销毁旧牛并生成新牛
                this.spawnNewCow(); 
            }
        } else {
            if (!this.ropeNode) {
                error("⚠️ ropeNode 未设置！");
            }
            if (!this.cowNode) {
                error("⚠️ cowNode 未设置！");
            }
            if (this.cowNode && !this.cowNode.isValid) {
                error("⚠️ cowNode 已被销毁！");
            }
        }
    }

    /**
     * 更新分数显示
     */
    updateScore() {
        if (this.score) {
            this.score.string = `Score: ${this.scoreValue}`;
        }
    }

    /**
     * 更新时间显示
     */
    updateTime() {
        if (this.time) {
            this.time.string = `${this.timeValue}s`;
        }
    }

    /**
     * 更新绳索样式
     */
    updateRopeSprite(ropeIndex: number) {
        if (this.ropeNode && this.robeSprites && this.robeSprites.length > 0) {
            // 确保索引在有效范围内
            if (ropeIndex >= 0 && ropeIndex < this.robeSprites.length) {
                this.currentRopeIndex = ropeIndex;
                const sprite = this.ropeNode.getComponent(Sprite);
                if (sprite) {
                    sprite.spriteFrame = this.robeSprites[ropeIndex];
                }
            } else {
                warn(`绳索样式索引 ${ropeIndex} 超出范围，绳索样式数组长度: ${this.robeSprites.length}`);
            }
        }
    }

    /**
     * 生成新的牛
     */
    spawnNewCow() {
        // 如果游戏已结束，不生成新牛
        if (this.isGameOver) {
            return;
        }
        
        if (!this.cowPrefab) {
            error("⚠️ cowPrefab 未设置！请在编辑器中拖入牛的预制体");
            return;
        }

        // 记录旧牛的父节点和位置信息
        let oldParent: Node | null = null;
        let oldPosition = { x: 0, y: 0 };
        
        if (this.cowNode) {
            oldParent = this.cowNode.parent;
            oldPosition.x = this.cowNode.position.x;
            oldPosition.y = this.cowNode.position.y;
            log(`旧牛位置: x=${oldPosition.x}, y=${oldPosition.y}`);
            
            // 销毁旧牛
            this.cowNode.destroy();
        }

        // 实例化新牛
        const newCow = instantiate(this.cowPrefab);
        
        // 添加到旧牛的父节点，如果没有则添加到 Canvas
        if (oldParent) {
            oldParent.addChild(newCow);
            log(`新牛添加到父节点: ${oldParent.name}`);
        } else if (this.node.parent) {
            this.node.parent.addChild(newCow);
            log(`新牛添加到 Main 的父节点: ${this.node.parent.name}`);
        } else {
            this.node.scene.addChild(newCow);
            log("新牛添加到场景根节点");
        }

        // 确保新牛可见
        newCow.active = true;
        
        // 设置新牛的锚点
        const uiTransform = newCow.getComponent(UITransform);
        if (uiTransform) {
            uiTransform.setAnchorPoint(0.12, 0.5);
            log("新牛锚点设置为: (0.12, 0.5)");
        }
        
        // 保存新牛的引用
        this.cowNode = newCow;
        
        // 验证新牛的组件
        const cowComp = newCow.getComponent(Cow);
        if (cowComp) {
            log(`✨ 生成新牛成功，位置: x=${newCow.position.x}, y=${newCow.position.y}, 牛类型: ${cowComp.getCowType()}`);
        } else {
            error("⚠️ 新牛没有 Cow 组件！");
        }
        
        log(`新牛节点信息: name=${newCow.name}, active=${newCow.active}, parent=${newCow.parent?.name}`);
    }

    onDestroy() {
        // 移除事件监听，避免内存泄漏
        // 需要检查节点是否有效，因为在场景重载时节点可能已被销毁
        try {
            if (this.buttonNode && this.buttonNode.isValid) {
                this.buttonNode.off(Node.EventType.TOUCH_START, this.onButtonPressed, this);
                this.buttonNode.off(Node.EventType.TOUCH_END, this.onButtonClicked, this);
                this.buttonNode.off(Node.EventType.TOUCH_CANCEL, this.onButtonCancel, this);
            }
        } catch (e) {
            // 忽略销毁时的错误
            console.log("onDestroy 清理事件时出错（可忽略）:", e);
        }
    }

    update(deltaTime: number) {
        // 如果游戏已结束，不再执行 update 逻辑
        if (this.isGameOver) {
            return;
        }
        
        // 倒计时功能
        if (this.timeValue > 0) {
            // 累加时间
            this.timeAccumulator += deltaTime;
            
            // 每过1秒
            if (this.timeAccumulator >= 1.0) {
                this.timeValue--;
                this.updateTime();
                this.timeAccumulator = 0; // 重置累加器
                
                // 时间用完
                if (this.timeValue <= 0) {
                    log(`游戏结束！最终分数: ${this.scoreValue}`);
                    this.isGameOver = true;
                    this.freezeGame();
                    this.showResult();
                }
            }
        }
    }

    /**
     * 冻结游戏画面
     */
    freezeGame() {
        log("❄️ 冻结游戏画面");
        
        // 不能使用 director.pause()，因为会暂停所有交互，包括 UI 按钮
        // 只停止游戏元素的动画即可
        
        // 停止所有牛的移动
        if (this.cowNode && this.cowNode.isValid) {
            // 禁用 Cow 组件的 update（停止帧动画）
            const cowComponent = this.cowNode.getComponent(Cow);
            if (cowComponent) {
                cowComponent.enabled = false;
            }
            
            // 停止牛节点上的所有 tween 动画（包括 repeatForever）
            Tween.stopAllByTarget(this.cowNode);
        }
        
        // 停止绳子的动画并隐藏
        if (this.ropeNode && this.ropeNode.isValid) {
            Tween.stopAllByTarget(this.ropeNode);
            this.ropeNode.active = false;
        }
        
        // 停止背景音乐
        if (this.bgMusic) {
            this.bgMusic.stop();
            log("🔇 背景音乐已停止");
        }
    }

    /**
     * 显示游戏结果
     */
    showResult() {
        if (!this.resultNode) {
            error("⚠️ resultNode 未设置！");
            return;
        }

        // 显示结果面板
        this.resultNode.active = true;

        // 查找 title 子节点并显示分数
        const titleNode = this.resultNode.getChildByName("title");
        if (titleNode) {
            const titleLabel = titleNode.getComponent(Label);
            if (titleLabel) {
                titleLabel.string = `分数: ${this.scoreValue}`;
                log(`显示分数: ${this.scoreValue}`);
            }
        } else {
            warn("⚠️ 未找到 title 子节点");
        }

        // 查找 role 子节点并显示水平
        const roleNode = this.resultNode.getChildByName("role");
        if (roleNode) {
            const roleLabel = roleNode.getComponent(Label);
            if (roleLabel) {
                let level = "";
                if (this.scoreValue <= 5) {
                    level = "青铜";
                } else if (this.scoreValue <= 10) {
                    level = "黄金";
                } else {
                    level = "大师";
                }
                roleLabel.string = level;
                log(`显示水平: ${level}`);
            }
        } else {
            warn("⚠️ 未找到 role 子节点");
        }

        // 查找 close 子节点并绑定点击事件
        const closeNode = this.resultNode.getChildByName("close");
        if (closeNode) {
            console.log(`找到 close 节点，active=${closeNode.active}`);
            
            // 确保节点可见
            closeNode.active = true;
            
            // 清除所有旧的事件监听器
            closeNode.off(Node.EventType.TOUCH_END);
            closeNode.off(Node.EventType.TOUCH_START);
            closeNode.off(Node.EventType.TOUCH_CANCEL);
            
            // 使用 once 确保事件只触发一次
            closeNode.once(Node.EventType.TOUCH_END, () => {
                console.log("✅ close 按钮被点击 - 准备重启");
                this.restartGame();
            }, this);
            
            // 设置节点到最高层，确保可点击
            if (closeNode.parent) {
                closeNode.setSiblingIndex(closeNode.parent.children.length - 1);
            }
            
            console.log("关闭按钮事件绑定成功（使用 once）");
        } else {
            console.error("⚠️ 未找到 close 子节点");
            // 打印所有子节点名称帮助调试
            console.log("resultNode 的所有子节点:");
            this.resultNode.children.forEach((child, index) => {
                console.log(`  ${index}: ${child.name}`);
            });
        }
    }

    /**
     * 重启游戏
     */
    restartGame() {
        // 防止重复点击
        if (this.isRestarting) {
            console.log("⚠️ 游戏正在重启中，请勿重复点击");
            return;
        }
        
        this.isRestarting = true;
        console.log("🔄 重启游戏");
        
        // 使用保存的场景名称
        let sceneName = this.currentSceneName;
        
        // 如果没有保存场景名称，尝试获取
        if (!sceneName || sceneName.trim() === "") {
            const currentScene = director.getScene();
            if (currentScene && currentScene.name) {
                sceneName = currentScene.name;
            } else {
                sceneName = "main"; // 默认场景名称
            }
        }
        
        console.log(`准备加载场景: "${sceneName}"`);
        
        // 清理当前场景的事件监听器，防止重复触发
        try {
            if (this.buttonNode && this.buttonNode.isValid) {
                this.buttonNode.off(Node.EventType.TOUCH_START);
                this.buttonNode.off(Node.EventType.TOUCH_END);
                this.buttonNode.off(Node.EventType.TOUCH_CANCEL);
            }
        } catch (e) {
            console.log("清理事件监听器时出错:", e);
        }
        
        // 使用 setTimeout 延迟加载，确保当前帧的所有操作完成
        setTimeout(() => {
            director.loadScene(sceneName, (err) => {
                if (err) {
                    console.error("❌ 场景加载失败:", err);
                    this.isRestarting = false;
                } else {
                    console.log("✅ 场景加载成功");
                }
            });
        }, 100);
    }
}

