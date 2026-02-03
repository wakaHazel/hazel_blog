import * as THREE from 'three/webgpu'
import { Game } from '../Game.js'
import { atan, float, Fn, PI, PI2, positionGeometry, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'
import gsap from 'gsap'
import { Inputs } from '../Inputs/Inputs.js'

export class Intro
{
    constructor()
    {
        // 获取游戏单例实例
        this.game = Game.getInstance()

        // 获取重生点位置，作为Intro场景的中心点
        const respawn = this.game.respawns.getDefault()
        this.center = respawn.position.clone()

        // 初始化加载圆环
        this.setCircle()
        // 初始化文字标签和图标
        this.setLabel()

        // 绑定update函数到tick事件，每帧更新
        this.update = this.update.bind(this)
        // 优先级设置为8，确保在合适的时机更新
        this.game.ticker.events.on('tick', this.update, 8)
    }

    setLabel()
    {
        // 创建一个Group来包含所有的标签元素
        this.label = new THREE.Group()
        this.label.position.copy(this.center)
        // 设置旋转顺序为YXZ
        this.label.rotation.reorder('YXZ')
        
        // 根据画质等级调整标签的位置和旋转
        if(this.game.quality.level === 0)
        {
            // 低画质下的位置调整
            this.label.position.x += 3.5
            this.label.position.z -= 1
            this.label.position.y = 3.3
            
            this.label.rotation.y = 0.4
        }
        else
        {
            // 高画质下的位置调整
            this.label.position.x += 2.3
            this.label.position.z -= 1.8
            this.label.position.y = 3.3

            this.label.rotation.y = 0.4
            this.label.rotation.x = -0.4
        }
        
        // 初始缩放设为极小值
        this.label.scale.setScalar(0.01)
        // 将标签组添加到场景中
        this.game.scene.add(this.label)

        // 初始化操作提示图标（鼠标/键盘/手柄）
        this.setText()
        // 初始化静音按钮
        this.setSoundButton()
    }

    setCircle()
    {
        this.circle = {}
        
        const radius = 3.5
        const thickness = 0.04
        this.circle.progress = 0
        // 用于平滑过渡进度的uniform变量
        this.circle.smoothedProgress = uniform(0)

        // 创建圆环几何体
        const geometry = new THREE.RingGeometry(radius - thickness, radius, 128, 1)

        // 创建材质，使用TSL（Three Shading Language）构建Shader
        const material = new THREE.MeshBasicNodeMaterial()
        material.outputNode = Fn(() =>
        {
            // 计算当前像素的角度
            const angle = atan(positionGeometry.y, positionGeometry.x)
            // 将角度映射到0-1范围，并反转方向
            const angleProgress = angle.div(PI2).add(0.5).oneMinus()

            // 如果当前角度进度大于平滑后的加载进度，则丢弃该像素（实现圆形进度条效果）
            this.circle.smoothedProgress.lessThan(angleProgress).discard()

            // 返回最终颜色，结合了reveal颜色和强度
            return vec4(this.game.reveal.color.mul(this.game.reveal.intensity), 1)
        })()

        // 创建圆环网格
        const mesh = new THREE.Mesh(geometry, material)
        
        // 设置圆环位置和旋转
        mesh.position.copy(this.center)
        mesh.position.y = 0.001 // 稍微抬高一点防止z-fighting
        mesh.rotation.x = - Math.PI * 0.5 // 旋转平铺在地面上
        mesh.rotation.z = Math.PI * 0.5
        
        this.game.scene.add(mesh)

        this.circle.mesh = mesh

        // 隐藏圆环的动画函数
        this.circle.hide = (callback = null) =>
        {
            const dummy = { scale: 1 }
            // 调试模式下动画速度加快
            const speedMultiplier = this.game.debug.active ? 4 : 1
            gsap.to(
                dummy,
                {
                    scale: 0,
                    duration: 1.5 / speedMultiplier,
                    // ease: 'back.in(1.7)',
                    ease: 'power4.in',
                    overwrite: true,
                    onUpdate: () =>
                    {
                        // 实时更新网格缩放
                        mesh.scale.setScalar(dummy.scale)
                    },
                    onComplete: () =>
                    {
                        if(typeof callback === 'function')
                            callback()

                        // 动画完成后移除网格
                        mesh.removeFromParent()
                    }
                }
            )
        }
    }

    setText()
    {
        this.text = {}

        // 创建平面几何体用于显示操作提示图标
        const scale = 1.3
        const geometry = new THREE.PlaneGeometry(2 * scale, 1 * scale)

        // 管理不同输入模式下的纹理
        this.text.textures = new Map()
        this.text.updateTexture = async () =>
        {
            // 根据当前输入模式决定使用哪个纹理名称
            let name = 'mouseKeyboard'
            
            if(this.game.inputs.mode === Inputs.MODE_GAMEPAD)
            {
                if(this.game.inputs.gamepad.type === 'xbox')
                {
                    name = 'gamepadXbox'
                }
                else
                {
                    name = 'gamepadPlaystation'
                }
            }
            else if(this.game.inputs.mode === Inputs.MODE_TOUCH)
            {
                name = 'touch'
            }

            // 尝试从缓存获取纹理
            let cachedTexture = this.text.textures.get(name)
            if(!cachedTexture)
            {
                // 如果缓存没有，则加载纹理
                // const loader = this.game.resourcesLoader.getLoader('textureKtx')
                // const resourcePath = `intro/${name}Label.ktx`
                
                // 临时改为加载 PNG
                const loader = this.game.resourcesLoader.getLoader('texture')
                const resourcePath = `intro/${name}Label.png`

                loader.load(
                    resourcePath,
                    (loadedTexture) =>
                    {
                        // 修复纹理反转问题
                        loadedTexture.flipY = false
                        
                        // 存入缓存
                        this.text.textures.set(name, loadedTexture)

                        // 更新材质的Shader节点
                        material.outputNode = Fn(() =>
                        {
                            // 采样纹理，红色通道小于0.5的像素丢弃（透明剔除）
                            texture(loadedTexture, vec2(uv().x, uv().y.oneMinus())).r.lessThan(0.5).discard()
                            return vec4(1)
                        })()
                        material.needsUpdate = true
                        mesh.visible = true
                    }
                )
            }
            else
            {
                // 如果有缓存，直接更新材质
                material.outputNode = Fn(() =>
                {
                    texture(cachedTexture, vec2(uv().x, uv().y.oneMinus())).r.lessThan(0.5).discard()
                    return vec4(1)
                })()
                material.needsUpdate = true
            }

        }

        // 初始化纹理
        this.text.updateTexture()

        // 创建材质
        const material = new THREE.MeshBasicNodeMaterial({
            transparent: true
        })

        // 监听输入模式变化事件，自动切换图标
        this.game.inputs.gamepad.events.on('typeChange', this.text.updateTexture)
        this.game.inputs.events.on('modeChange', this.text.updateTexture)

        const mesh = new THREE.Mesh(geometry, material)
        mesh.visible = false // 初始隐藏，等纹理加载好再显示

        this.label.add(mesh)

        this.text.mesh = mesh
    }

    setSoundButton()
    {
        this.soundButton = {}

        // 获取声音图标纹理
        const texture = this.game.resources.soundTexture
        
        // 如果初始是静音状态，调整纹理偏移显示静音图标
        if(this.game.audio.mute.active)
            texture.offset.x = 0.5

        // 创建几何体
        const scale = 0.5
        const geometry = new THREE.PlaneGeometry(50 / 38 * scale, 1 * scale)

        // 创建材质
        const intensity = uniform(1)
        const material = new THREE.MeshBasicNodeMaterial({
            alphaTest: 0.5,
            alphaMap: texture,
            transparent: true,
            outputNode: vec4(vec3(1).mul(intensity), 1) // 颜色乘以强度，用于hover发光效果
        })

        // 创建网格并设置位置
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.x = 0.38
        mesh.position.y = - 1
        this.label.add(mesh)

        // 创建射线检测区域（RayCursor交互）
        const position = this.label.position.clone()
        position.x += 0.38
        position.y += - 1

        this.soundButton.intersect = this.game.rayCursor.addIntersect({
            active: true,
            shape: new THREE.Sphere(position, 0.5),
            onClick: () =>
            {
                // 点击切换静音
                this.game.audio.mute.toggle()
            },
            onEnter: () =>
            {
                // 鼠标悬停发光
                gsap.to(intensity, { value: 1.5, duration: 0.3, overwrite: true })
            },
            onLeave: () =>
            {
                // 鼠标移出恢复
                gsap.to(intensity, { value: 1, duration: 0.3, overwrite: true })
            }
        })

        // 监听静音状态变化，更新图标纹理
        this.game.audio.events.on('muteChange', (active) =>
        {
            texture.offset.x = active ? 0.5 : 0
        })

        this.soundButton.mesh = mesh
    }

    showLabel()
    {
        const dummy = { scale: 0 }
        const speedMultiplier = this.game.debug.active ? 4 : 1
        // 标签出现的弹跳动画
        gsap.to(
            dummy,
            {
                scale: 1,
                duration: 2 / speedMultiplier,
                delay: 1 / speedMultiplier,
                ease: 'elastic.out(0.5)',
                overwrite: true,
                onUpdate: () =>
                {
                    this.label.scale.setScalar(dummy.scale)
                }
            }
        )
    }

    hideLabel()
    {
        const speedMultiplier = this.game.debug.active ? 4 : 1
        const dummy = { scale: 1 }
        // 标签消失动画
        gsap.to(
            dummy,
            {
                scale: 0,
                duration: 0.3 / speedMultiplier,
                ease: 'power2.in',
                overwrite: true,
                onUpdate: () =>
                {
                    this.label.scale.setScalar(dummy.scale)
                },
                onComplete: () =>
                {
                    // 动画完成后清理资源
                    this.text.mesh.removeFromParent()
                    this.soundButton.mesh.removeFromParent()
                    this.game.rayCursor.removeIntersect(this.soundButton.intersect)
                }
            }
        )
    }

    updateProgress(progress)
    {
        // 更新加载进度
        this.circle.progress = progress
    }

    update()
    {
        // 每帧平滑更新圆环进度
        this.circle.smoothedProgress.value += (this.circle.progress - this.circle.smoothedProgress.value) * this.game.ticker.delta * 10
    }

    destroy()
    {
        // 销毁整个Intro实例，清理所有资源和事件
        this.label.removeFromParent()

        // 销毁几何体
        this.circle.mesh.geometry.dispose()
        this.soundButton.mesh.geometry.dispose()
        this.text.mesh.geometry.dispose()

        // 销毁材质
        this.circle.mesh.material.dispose()
        this.soundButton.mesh.material.dispose()
        this.text.mesh.material.dispose()

        // 销毁纹理
        this.game.resources.soundTexture.dispose()

        this.text.textures.forEach((value, key) =>
        {
            value.dispose()
        })
        
        // 移除事件监听
        this.game.ticker.events.off('tick', this.update)
        this.game.inputs.gamepad.events.off('typeChange', this.text.updateTexture)
        this.game.inputs.events.off('modeChange', this.text.updateTexture)
    }
}