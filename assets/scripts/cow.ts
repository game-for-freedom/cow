import { _decorator, Component, Sprite, SpriteFrame, tween, Vec3 } from 'cc';
const { ccclass, property } = _decorator;

/**
 * 牛的皮肤类
 */
@ccclass('CowSkin')
export class CowSkin {
    @property([SpriteFrame])
    cows: SpriteFrame[] = [];
}

/**
 * 牛组件
 */
@ccclass('Cow')
export class Cow extends Component {
    @property([CowSkin])
    cowSets: CowSkin[] = [];

    // 间隔时间
    private intervalTime: number = 0;
    // 随机的牛的类型
    private randomType: number = 0;

    onLoad() {
        this.intervalTime = 0;
        // 随机一种类型
        this.randomType = Math.floor(Math.random() * 3);
    }

    start() {
        // 设置初始位置
        this.node.setPosition(600, this.node.position.y, 0);
        
        // 创建循环移动动画
        tween(this.node)
            .to(3, { position: new Vec3(-600, this.node.position.y, 0) }) // 3秒从 x=600 移动到 x=-600
            .call(() => {
                // 移动完成后重置到起始位置
                this.node.setPosition(600, this.node.position.y, 0);
            })
            .union() // 将上面的动作组合成一个整体
            .repeatForever() // 无限循环
            .start(); // 开始动画
    }

    update(dt: number) {
        // 间隔时间
        this.intervalTime += dt;
        let index = Math.floor(this.intervalTime / 0.2);
        index = index % 3;
        
        // 获取一种牛的类型
        let cowSet = this.cowSets[this.randomType];

        // 获取精灵组件
        let sprite = this.node.getComponent(Sprite);
        if (sprite && cowSet && cowSet.cows[index]) {
            sprite.spriteFrame = cowSet.cows[index];
        }
    }

    runCallback() {
        console.log("一个轮回结束！");
        this.randomType = Math.floor(Math.random() * 3);
    }

    /**
     * 获取当前牛的类型
     */
    getCowType(): number {
        return this.randomType + 1;
    }
}

