import * as THREE from 'three/webgpu'
import { color, float, Fn, instancedArray, mix, normalWorld, positionGeometry, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js'
import { Inputs } from '../../Inputs/Inputs.js'
import { InteractivePoints } from '../../InteractivePoints.js'
import { Area } from './Area.js'
import gsap from 'gsap'
import { MeshDefaultMaterial } from '../../Materials/MeshDefaultMaterial.js'

export class LandingArea extends Area
{
    constructor(model)
    {
        super(model)

        this.localTime = uniform(0)

        this.setLetters()
        this.setKiosk()
        this.setControls()
        this.setBonfire()
        this.setAchievement()
    }

    setLetters()
    {
        const references = this.references.items.get('letters')

        if(references)
        {
            // Load font for replacement
            const loader = this.game.resourcesLoader.getLoader('font')
            loader.load(
                'fonts/helvetiker_bold.typeface.json',
                (font) =>
                {
                    // Define replacement text
                    const newText = "HAZEL BLOG"
                    const letterSpacing = 1.5 // Adjust based on visual need
                    
                    // Sort references by x position to replace in order (left to right)
                    references.sort((a, b) => a.position.x - b.position.x)
                    
                    // Hide all original letters
                    for(const reference of references)
                    {
                        reference.visible = false
                        // Disable original collider events
                        const physical = reference.userData.object.physical
                        if(physical && physical.colliders && physical.colliders.length > 0)
                        {
                            // We keep the physical body for interaction but maybe update its shape later?
                            // For now, let's keep the original physics to avoid complexity
                            // Just attach events to it
                            physical.colliders[0].setActiveEvents(this.game.RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
                            physical.colliders[0].setContactForceEventThreshold(5)
                            physical.onCollision = (force, position) =>
                            {
                                this.game.audio.groups.get('hitBrick').playRandomNext(force, position)
                            }
                        }
                    }

                    // Create new letters
                    // We will reuse the first few references' positions as anchors
                    // Or we can just place them centered where the old ones were
                    
                    const material = new MeshDefaultMaterial({ colorNode: color(0xffffff) })
                    
                    let refIndex = 0

                    for(let i = 0; i < newText.length; i++)
                    {
                        const char = newText[i]

                        // Handle space: skip one reference position (make it invisible)
                        if(char === ' ')
                        {
                            if(refIndex < references.length)
                            {
                                references[refIndex].visible = false
                                // Move physics body away to avoid invisible collision
                                const physical = references[refIndex].userData.object.physical
                                if(physical && physical.body) {
                                    physical.body.setTranslation({x: 0, y: -100, z: 0}, true)
                                }
                                refIndex++
                            }
                            continue
                        }

                        if(refIndex < references.length)
                        {
                            const currentIndex = refIndex
                            const reference = references[refIndex]
                            refIndex++

                            const textGeometry = new TextGeometry(char, {
                                font: font,
                                size: 1.5,
                                depth: 0.4,
                                curveSegments: 12,
                                bevelEnabled: true,
                                bevelThickness: 0.03,
                                bevelSize: 0.02,
                                bevelOffset: 0,
                                bevelSegments: 5
                            })
                            
                            // Center geometry
                            textGeometry.computeBoundingBox()
                            const width = textGeometry.boundingBox.max.x - textGeometry.boundingBox.min.x
                            const height = textGeometry.boundingBox.max.y - textGeometry.boundingBox.min.y
                            
                            const centerOffsetX = - 0.5 * width
                            const centerOffsetY = - 0.5 * height

                            // Manual adjustment for "BLOG" spacing (using geometry translation to avoid HMR accumulation)
                            let extraSpacingX = 0
                            if(currentIndex === 7) extraSpacingX = 0.15 // Move L right
                            if(currentIndex === 8) extraSpacingX = 0.18 // Move O right (closer to L)
                            if(currentIndex === 9) extraSpacingX = 0.38 // Move G right (maintain spacing with O)

                            textGeometry.translate(centerOffsetX + extraSpacingX, centerOffsetY, 0)
                            
                            // Store original X if not present (for HMR safety)
                            if (reference.userData.originalX === undefined) {
                                reference.userData.originalX = reference.position.x
                            }
                            
                            // Reset to original X before applying offset
                            reference.position.x = reference.userData.originalX

                            // Manual adjustment for "BLOG" spacing to avoid overlap
                            // Original "I" (index 6) was narrow, so "B" needs more room
                            // We shift subsequent letters slightly to the right
                            // if(currentIndex === 6) reference.position.x += 0.1 // B
                            // if(currentIndex === 7) reference.position.x += 0.35 // L
                            // if(currentIndex === 8) reference.position.x += 0.7 // O (Separate L and O)
                            // if(currentIndex === 9) reference.position.x += 0.95 // G

                            // Replace Geometry
                            reference.geometry.dispose()
                            reference.geometry = textGeometry
                            reference.material = material
                            reference.visible = true

                            // Reset Physics Body Position to original reference position (with manual offsets applied)
                            const physical = reference.userData.object.physical
                            if(physical && physical.body)
                            {
                                physical.body.setTranslation({
                                    x: reference.position.x,
                                    y: reference.position.y,
                                    z: reference.position.z
                                }, true)
                                
                                physical.body.setRotation(reference.quaternion, true)
                            }
                        }
                    }
                    
                    // Hide remaining original letters
                    for(let i = refIndex; i < references.length; i++)
                    {
                         references[i].visible = false
                         const physical = references[i].userData.object.physical
                         if(physical && physical.body) {
                             physical.body.setTranslation({x: 0, y: -100, z: 0}, true)
                         }
                    }
                }
            )
        }
    }

    setKiosk()
    {
        const reference = this.references.items.get('kioskInteractivePoint')

        if(!reference)
            return

        // Interactive point
        const interactivePoint = this.game.interactivePoints.create(
            reference[0].position,
            '地图',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.inputs.interactiveButtons.clearItems()
                this.game.modals.open('map')
                // interactivePoint.hide()
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )

        // this.game.map.items.get('map').events.on('close', () =>
        // {
        //     interactivePoint.show()
        // })
    }

    setControls()
    {
        const reference = this.references.items.get('controlsInteractivePoint')
        
        if(!reference)
            return

        // Interactive point
        const interactivePoint = this.game.interactivePoints.create(
            reference[0].position,
            '操作',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.inputs.interactiveButtons.clearItems()
                this.game.menu.open('controls')
                interactivePoint.hide()
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )

        // Menu instance
        const menuInstance = this.game.menu.items.get('controls')

        menuInstance.events.on('close', () =>
        {
            interactivePoint.show()
        })

        menuInstance.events.on('open', () =>
        {
            if(this.game.inputs.mode === Inputs.MODE_GAMEPAD)
                menuInstance.tabs.goTo('gamepad')
            else if(this.game.inputs.mode === Inputs.MODE_MOUSEKEYBOARD)
                menuInstance.tabs.goTo('mouse-keyboard')
            else if(this.game.inputs.mode === Inputs.MODE_TOUCH)
                menuInstance.tabs.goTo('touch')
        })
    }

    setBonfire()
    {
        const position = this.references.items.get('bonfireHashes')[0].position

        // Particles
        let particles = null
        {
            const emissiveMaterial = this.game.materials.getFromName('emissiveOrangeRadialGradient')
    
            const count = 30
            const elevation = uniform(5)
            const positions = new Float32Array(count * 3)
            const scales = new Float32Array(count)
    
    
            for(let i = 0; i < count; i++)
            {
                const i3 = i * 3
    
                const angle = Math.PI * 2 * Math.random()
                const radius = Math.pow(Math.random(), 1.5) * 1
                positions[i3 + 0] = Math.cos(angle) * radius
                positions[i3 + 1] = Math.random()
                positions[i3 + 2] = Math.sin(angle) * radius
    
                scales[i] = 0.02 + Math.random() * 0.06
            }
            
            const positionAttribute = instancedArray(positions, 'vec3').toAttribute()
            const scaleAttribute = instancedArray(scales, 'float').toAttribute()
    
            const material = new THREE.SpriteNodeMaterial()
            material.outputNode = emissiveMaterial.outputNode
    
            const progress = float(0).toVar()
    
            material.positionNode = Fn(() =>
            {
                const newPosition = positionAttribute.toVar()
                progress.assign(newPosition.y.add(this.localTime.mul(newPosition.y)).fract())
    
                newPosition.y.assign(progress.mul(elevation))
                newPosition.xz.addAssign(this.game.wind.direction.mul(progress))
    
                const progressHide = step(0.8, progress).mul(100)
                newPosition.y.addAssign(progressHide)
                
                return newPosition
            })()
            material.scaleNode = Fn(() =>
            {
                const progressScale = progress.remapClamp(0.5, 1, 1, 0)
                return scaleAttribute.mul(progressScale)
            })()
    
            const geometry = new THREE.CircleGeometry(0.5, 8)
    
            particles = new THREE.Mesh(geometry, material)
            particles.visible = false
            particles.position.copy(position)
            particles.count = count
            this.game.scene.add(particles)
        }

        // Hashes
        {
            const alphaNode = Fn(() =>
            {
                const baseUv = uv(1)
                const distanceToCenter = baseUv.sub(0.5).length()
    
                const voronoi = texture(
                    this.game.noises.voronoi,
                    baseUv
                ).g
    
                voronoi.subAssign(distanceToCenter.remap(0, 0.5, 0.3, 0))
    
                return voronoi
            })()
    
            const material = new MeshDefaultMaterial({
                colorNode: color(0x6F6A87),
                alphaNode: alphaNode,
                hasWater: false,
                hasLightBounce: false
            })
    
            const mesh = this.references.items.get('bonfireHashes')[0]
            mesh.material = material
        }

        // Burn
        const burn = this.references.items.get('bonfireBurn')[0]
        burn.visible = false

        // Interactive point
        this.game.interactivePoints.create(
            this.references.items.get('bonfireInteractivePoint')[0].position,
            '重置',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.reset()

                gsap.delayedCall(2, () =>
                {
                    // Bonfire
                    particles.visible = true
                    burn.visible = true
                    this.game.ticker.wait(2, () =>
                    {
                        particles.geometry.boundingSphere.center.y = 2
                        particles.geometry.boundingSphere.radius = 2
                    })

                    // Sound
                    this.game.audio.groups.get('campfire').items[0].positions.push(position)
                })
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )
    }

    setAchievement()
    {
        this.events.on('boundingIn', () =>
        {
            this.game.achievements.setProgress('areas', 'landing')
        })
        this.events.on('boundingOut', () =>
        {
            this.game.achievements.setProgress('landingLeave', 1)
        })
    }

    update()
    {
        this.localTime.value += this.game.ticker.deltaScaled * 0.1
    }
}