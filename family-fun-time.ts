/*

This script gives the player and the agent fun powers and abilities.
These abilities include powers, teleportation, grenades and weapons.
To use these abilities, equip respective item and interact:
* Iron Door        : Teleport agent to player
* Oak Door         : Teleport player to agent
* Skeleton Skull   : Agent disappears with an explosion particle
* Gunpowder        : Prime a TNT at the agent's location
* Charcoal         : Throw smoke grenade
* Dragon's Breath  : Throw poison grenade
* Redstone         : Throw thumper grenade
* Prismarine Shard : Throw concussion grenade
* Fire Charge      : Throw molotov cocktail
* Echo Shard       : Teleport forward until obstacle (max 20 blocks)
* Feather          : Teleport up 20 blocks
* Sugar            : Temporary superpowers
* Lightning Rod    : Orbital strike

*/
const PI: number = 3.141592653589793
const GRAVITY: number = 0.1
const THROW_ITERATIONS: number = 50
const DIRECTION_DISTANCE: number = 10
const THROW_VERTICAL_ADJUST: number = 0.5

// Get direction unit vector
function getDirection(): number[] {
    let pos: Position = player.position().toWorld()
    let loc: Position = posLocal(0, 0, DIRECTION_DISTANCE).toWorld()
    return [Axis.X, Axis.Y, Axis.Z].map((axis: Axis) => (loc.getValue(axis) - pos.getValue(axis)) / DIRECTION_DISTANCE)
}
// Simulates a throw from a position in a direction vector leaving a particle trail
function simulateThrow(pos: Position, da: number[], particle: Particle): Position {
    pos = pos.toWorld()
    let [dx, dy, dz] = da
    for (let i = 0; i < THROW_ITERATIONS; i++) {
        if (!blocks.testForBlock(Block.Air, pos)) break
        mobs.spawnParticle(particle, pos)
        pos = positions.add(pos, world(dx, dy, dz))
        dy -= GRAVITY
    }
    return pos
}
// Simulates a player throw
function playerThrow(particle: Particle): Position {
    asyncPlaySound(Sound.Fizz)
    let p: Position = pos(0, 1, 0)
    let da: number[] = getDirection()
    da[1] += THROW_VERTICAL_ADJUST
    return simulateThrow(p, da, particle)
}
// Repeat a function continuously for a duration with a default interval of 0
function repeatFor(f: Function, duration: number, interval: number = 0): void {
    let running: boolean = true
    loops.runInBackground(function () {
        loops.pause(duration)
        running = false
    })
    while (running) {
        f()
        loops.pause(interval)
    }
}
// Plays a sound without blocking code execution
function asyncPlaySound(sound: Sound): void {
    loops.runInBackground(() => music.playSound(sound))
}

// Teleports the agent to you
player.onItemInteracted(Item.IronDoor, function () {
    asyncPlaySound(Sound.Trident)
    agent.teleport(pos(0, 0, 0), positions.toCompassDirection(player.getOrientation()))
})
// Teleports you to the agent
player.onItemInteracted(Item.OakDoor, function () {
    asyncPlaySound(Sound.Trident)
    player.teleport(agent.getPosition())
})
// Agent disappears with an explosion particle
player.onItemInteracted(Block.SkeletonSkull, function () {
    mobs.spawnParticle(Particle.ExplosionHuge, agent.getPosition())
    mobs.kill(mobs.target(TargetSelectorKind.MyAgent))
})
// Prime a TNT at the agent's location
player.onItemInteracted(Item.Gunpowder, function () {
    asyncPlaySound(Sound.Fuse)
    mobs.spawn(ProjectileMob.PrimedTnt, agent.getPosition())
})
// Throw a smoke grenade that hides mobs inside
player.onItemInteracted(Item.Charcoal, () => loops.runInBackground(function () {
    let pos: Position = playerThrow(Particle.SmokeCampfire)
    repeatFor(function () {
        asyncPlaySound(Sound.Fizz)
        let selector: TargetSelector = mobs.near(mobs.target(TargetSelectorKind.AllEntities), pos, 5)
        player.execute(`effect ${selector.toString()} invisibility 2 1 true`)
        mobs.spawnParticle(Particle.ExplosionHuge, pos)
    }, 15000)
}))
// Throw a poison gas grenade that poisons mobs inside
player.onItemInteracted(Item.DragonSBreath, () => loops.runInBackground(function () {
    let pos: Position = playerThrow(Particle.SmokeLlamaSpit)
    repeatFor(function () {
        asyncPlaySound(Sound.Fizz)
        let selector: TargetSelector = mobs.near(mobs.target(TargetSelectorKind.AllEntities), pos, 5)
        mobs.applyEffect(Effect.Poison, selector, 2, 100)
        let smokePos: Position = randpos(positions.add(pos, world(-3, 0, -3)), positions.add(pos, world(3, 3, 3)))
        mobs.spawnParticle(Particle.ElephantToothPasteVapor, smokePos)
    }, 15000)
}))
// Throw a thumper grenade that deals 3 pulses of damage to mobs inside
player.onItemInteracted(Item.Redstone, () => loops.runInBackground(function () {
    let pos: Position = playerThrow(Particle.SmokeBasic)
    let selector: TargetSelector = mobs.near(mobs.target(TargetSelectorKind.AllEntities), pos, 5)
    asyncPlaySound(Sound.Blaze)
    loops.pause(1000)
    for (let i = 0; i < 3; i++) {
        mobs.spawnParticle(Particle.ExplosionHugeLab, pos)
        asyncPlaySound(Sound.PlayerHurt)
        asyncPlaySound(Sound.Firework)
        player.execute(`damage ${selector.toString()} 5`)
        loops.pause(700)
    }
}))
// Throw a concussion grenade that blinds, disorients and slows mobs inside
player.onItemInteracted(Item.PrismarineShard, () => loops.runInBackground(function () {
    let pos: Position = playerThrow(Particle.SmokeBasic)
    let selector: TargetSelector = mobs.near(mobs.target(TargetSelectorKind.AllEntities), pos, 5)
    asyncPlaySound(Sound.Dolphin)
    loops.pause(1000)
    mobs.spawnParticle(Particle.ExplosionHugeLab, pos)
    asyncPlaySound(Sound.Firework)
    loops.runInBackground(() => music.playNote(Note.FSharp5, Instrument.Flute, 1))
    let effects: Effect[] = [Effect.Blindness, Effect.Nausea, Effect.Slowness]
    effects.forEach((effect: Effect) => {
        mobs.applyEffect(effect, selector, 10)
    })
}))
// Throw a molotov cocktail that sets an area on fire for 10 seconds
player.onItemInteracted(Item.Fireball, () => loops.runInBackground(function () {
    let pos: Position = playerThrow(Particle.FireVapor)
    asyncPlaySound(Sound.FireworkLarge)
    mobs.spawnParticle(Particle.ExplosionCauldron, positions.add(pos, world(0, 2, 0)))
    let corner1: Position = positions.add(pos, world(-2, -1, -2))
    let corner2: Position = positions.add(pos, world(2, 3, 2))
    blocks.replace(Block.Fire, Block.Air, corner1, corner2)
    loops.pause(10000)
    blocks.replace(Block.Air, Block.Fire, corner1, corner2)
}))
// Teleport forward until the path is blocked to if reached 20 blocks
player.onItemInteracted(Item.EchoShard, function () {
    asyncPlaySound(Sound.ElderGuardian)
    let pos: Position = player.position()
    let orientation: number = (player.getOrientation() + 360) % 360 * PI / 180;
    let dx: number = -Math.sin(orientation)
    let dz: number = Math.cos(orientation)
    for (let i = 0; i <= 20; i++) {
        mobs.spawnParticle(Particle.SoulSculk, pos)
        let newPos: Position = positions.add(pos, world(dx, 0, dz))
        if (
            blocks.testForBlock(Block.Air, newPos) &&
            blocks.testForBlock(Block.Air, positions.add(newPos, world(0, 1, 0))) &&
            i !== 20
        ) pos = newPos
        else {
            player.teleport(pos)
            break
        }
    }
})
// Teleport the player 20 blocks up
player.onItemInteracted(Item.Feather, function () {
    asyncPlaySound(Sound.Click)
    player.teleport(pos(0, 20, 0))
})
// Gives player powers
player.onItemInteracted(Item.Sugar, function () {
    asyncPlaySound(Sound.LevelUp)
    const duration: number = 10
    const effects: [Effect, number][] = [
        [Effect.Speed, 20],
        [Effect.JumpBoost, 3],
        [Effect.Regeneration, 255],
        [Effect.Strength, 2],
        [Effect.NightVision, 1]
    ]
    let self: TargetSelector = mobs.target(TargetSelectorKind.LocalPlayer)
    effects.forEach((effect: [Effect, number]) => {
        let [effectType, amplifier] = effect
        mobs.applyEffect(effectType, self, duration, amplifier)
    })
})
// Call an orbital strike to strike the area around the agent with lightning
player.onItemInteracted(Block.LightningRod, function () {
    const rad: number = 3
    let pos: Position = agent.getPosition()
    for (let i = 0; i < 4; i++) {
        let x: number = rad * (i < 2 ? -1 : 1)
        let z: number = rad * (i % 2 === 1 ? -1 : 1)
        mobs.spawn(ProjectileMob.FireworksRocket, positions.add(pos, world(x, 0, z)))
    }
    loops.pause(2000)
    for (let i = 0; i < 4; i++) {
        for (let x = -rad; x <= rad; x++) {
            for (let z = -rad; z <= rad; z++) {
                mobs.spawn(ProjectileMob.LightningBolt, positions.add(pos, world(x, 0, z)))
            }
        }
    }
})
