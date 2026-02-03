import { Game } from './Game.js'
import { Inputs } from './Inputs/Inputs.js'
import { Menu } from './Menu.js'
import { Modals } from './Modals.js'
import { CircuitArea } from './World/Areas/CircuitArea.js'
import { LabArea } from './World/Areas/LabArea.js'
import { ProjectsArea } from './World/Areas/ProjectsArea.js'

export class ClosingManager
{
    constructor()
    {
        this.game = Game.getInstance()

        this.game.inputs.addActions([
            { name: 'close', categories: [ 'modal', 'menu', 'racing', 'cinematic', 'wandering' ], keys: [ 'Keyboard.Escape', 'Gamepad.cross' ] },
            { name: 'pause', categories: [ 'modal', 'menu', 'racing', 'cinematic', 'wandering' ], keys: [ 'Gamepad.start' ] }
        ])
        
        // Close input => Go through everything that can be closed
        this.game.inputs.events.on('close', (action) =>
        {
            if(action.active)
            {
                try
                {
                    // Whispers flag select => Close
                    if(this.game.world.whispers?.menu?.inputFlag?.isOpen)
                    {
                        this.game.world.whispers.menu.inputFlag.close()
                        return
                    }

                    // Circuit flag select => Close
                    if(this.game.world.areas?.circuit?.menu?.inputFlag?.isOpen)
                    {
                        this.game.world.areas.circuit.menu.inputFlag.close()
                        return
                    }
                    
                    // Modal open => Close
                    if(this.game.modals.state === 1 || this.game.modals.state === 2) // Modals.OPEN, Modals.OPENING
                    {
                        this.game.modals.close()
                        return
                    }
                    
                    // Menu open => Close
                    if(this.game.menu.state === 1 || (this.game.inputs.mode !== Inputs.MODE_GAMEPAD && this.game.menu.state === 2)) // Menu.OPEN, Menu.OPENING
                    {
                        this.game.menu.close()
                        return
                    }

                    // Circuit running
                    const circuit = this.game.world.areas?.circuit
                    if(circuit && (circuit.state === 3 || circuit.state === 2)) // CircuitArea.STATE_RUNNING, CircuitArea.STATE_STARTING
                    {
                        this.game.menu.open('circuit')
                        return
                    }

                    // Projects => Close
                    const projects = this.game.world.areas?.projects
                    if(projects && (projects.state === 3 || projects.state === 4)) // ProjectsArea.STATE_OPEN, ProjectsArea.STATE_OPENING
                    {
                        projects.close()
                        return
                    }

                    // Lab => Close
                    const lab = this.game.world.areas?.lab
                    if(lab && (lab.state === 3 || lab.state === 4)) // LabArea.STATE_OPEN, LabArea.STATE_OPENING
                    {
                        lab.close()
                        return
                    }

                    // Nothing opened and used the keyboard Escape key => Open default modal
                    if(action.activeKeys.has('Keyboard.Escape'))
                    {
                        this.game.menu.open()
                        return
                    }
                }
                catch(_error)
                {
                    console.warn('ClosingManager: Error in close action chain', _error)
                }
            }
        })

        // Pause input => Close menu or open menu  intro
        this.game.inputs.events.on('pause', (action) =>
        {
            if(action.active)
            {
                if(this.game.menu.state === Menu.OPEN || this.game.menu.state === Menu.OPENING)
                {
                    this.game.menu.close()
                }
                else
                {
                    this.game.menu.open('home')
                }
            }
        })

        // On modal open => Close menu
        this.game.modals.events.on('open', () =>
        {
            if(this.game.menu.state === Menu.OPEN || this.game.menu.state === Menu.OPENING)
                this.game.menu.close()
        })

        // On menu open => Close modal
        this.game.menu.events.on('open', () =>
        {
            if(this.game.modals.state === Modals.OPEN || this.game.modals.state === Modals.OPENING)
                this.game.modals.close()
        })

        // Fail-safe for Escape key (especially for Chrome focus issues)
        const emergencyClose = (_event) =>
        {
            if(_event.code === 'Escape' || _event.key === 'Escape' || _event.keyCode === 27)
            {
                this.game.inputs.events.trigger('close', [{ active: true, activeKeys: new Set(['Keyboard.Escape']) }])
            }
        }
        window.addEventListener('keydown', emergencyClose, { capture: true })
        window.addEventListener('keyup', emergencyClose, { capture: true })
        document.addEventListener('keydown', emergencyClose, { capture: true })
        document.addEventListener('keyup', emergencyClose, { capture: true })

        // Handle fullscreen exit as a close action (browser consumes Esc key in fullscreen)
        document.addEventListener('fullscreenchange', () =>
        {
            if(!document.fullscreenElement)
            {
                // Trigger close action as if Escape was pressed
                this.game.inputs.events.trigger('close', [{ active: true, activeKeys: new Set(['Keyboard.Escape']) }])
            }
        })

        // On modal close => Go to wandering or racing
        const modalMenuCloseCallback = () =>
        {
            this.game.inputs.filters.clear()

            if(
                this.game.world.areas?.circuit?.state === CircuitArea.STATE_RUNNING ||
                this.game.world.areas?.circuit?.state === CircuitArea.STATE_STARTING ||
                this.game.world.areas?.circuit?.state === CircuitArea.STATE_ENDING
            )
            {
                this.game.inputs.filters.add('racing')
            }
            else
            {
                this.game.inputs.filters.add('wandering')
            }
        }
        this.game.modals.events.on('close', modalMenuCloseCallback)
        this.game.menu.events.on('close', modalMenuCloseCallback)
    }
}