/*

This is a Minecraft-based visual interpreter for Brainf**k using colored wool blocks.
The agent moves forwards, executing brainf**k commands according to the block below it:
* Light Gray Wool : < (move pointer left)
* Gray Wool       : > (move pointer right)
* Lime Wool       : + (increment cell)
* Red Wool        : - (decrement cell)
* Black Wool      : . (output cell)
* White Wool      : , (assign cell to input)
* Yellow Wool     : [ (start loop)
* Light Blue Wool : ] (end loop)
* Pink Wool       : n (newline -> agent moves to the next line)
* Magenta Wool    : e (end the program)

Commands:
* iotoggle    : Toggle input/output mode (char<->number)
* debugtoggle : Toggle debug mode
* reset       : Reset memory
* input <val> : Give input when ',' is met
* run         : Run the program

Printing color codes:
* §9(Blue): Info
* §b(Aqua): I/O
* §e(Yellow): Warning
* §c(Red): Error
* §a(Green): Success
* §l§2(Bold, Dark Green): Debug

Usage:
Place the agent at the start of the program facing the rest of the line and type `run` in game chat.
Example (from top-down view where → is the direction the agent is facing):

→+++++>[+++++++++++++<-]n
>.e

*/
const COMMANDS: any = {
    [Block.LightGrayWool]: "<",
    [Block.GrayWool]: ">",
    [Block.LimeWool]: "+",
    [Block.RedWool]: "-",
    [Block.BlackWool]: ".",
    [Block.Wool]: ",",
    [Block.YellowWool]: "[",
    [Block.LightBlueWool]: "]",
    [Block.PinkWool]: "n",
    [Block.MagentaWool]: "e"
}
const TAPE_LENGTH: number = 30
const NUM_VALUES: number = 256
const MAX_STEPS: number = 1000

// Get input and output character by ascii code(true)/raw number value(false)
let ioChar: boolean = true
// Print pointer and cell values after each executed instruction if true
let debugMode: boolean = false

let tape: number[] = []
let ptr: number = 0
// This appends the opening position when a loop opens and pops when the loop closes
let loopStack: Position[] = []
// This appends the line start position when a loop opens and pops when the loop closes
let lineStartStack: Position[] = []
for (let i = 0; i < TAPE_LENGTH; i++) tape.push(0)

function getCommand(): string {
    let block: Block = agent.inspect(AgentInspection.Block, SixDirection.Down)
    return COMMANDS[block] || ""
}

// Toggle input/output mode between character and number
player.onChat("iotoggle", function() {
    ioChar = !ioChar
    player.say(`§9ioChar toggled to: ${ioChar}`)
})

// Toggle debug mode (print pointer and cell values after each executed instruction)
player.onChat("debugtoggle", function() {
    debugMode = !debugMode
    player.say(`§l§2Debug mode: ${debugMode}`)
})

// Reset memory
player.onChat("reset", function() {
    tape = tape.map(() => 0)
    ptr = 0
    loopStack = []
    lineStartStack = []
    player.say("§9Tape, pointer and cache reset.")
})

// Use when the program asks for input
let input: string = undefined
player.onChat("input", function(_) {
    input = player.getChatArg(0)
})

// Run the brainf**k program
player.onChat("run", function() {
    player.say("§9Code execution starting...")
    const orientation: number = positions.toCompassDirection(agent.getOrientation())
    let lineStart: Position = agent.getPosition()
    let step: number = 0
    while (step < MAX_STEPS) {
        step++
        let cmd: string = getCommand()
        if (cmd === "<") {
            // Shift the pointer left or to TAPE_LENGTH-1 if it is 0
            ptr = (ptr - 1 + TAPE_LENGTH) % TAPE_LENGTH
        } else if (cmd === ">") {
            // Shift the pointer right or to 0 if it is TAPE_LENGTH-1
            ptr = (ptr + 1 + TAPE_LENGTH) % TAPE_LENGTH
        } else if (cmd === "+") {
            // Increment the cell or set it to 0 if it is NUM_VALUES-1
            tape[ptr] = (tape[ptr] + 1 + NUM_VALUES) % NUM_VALUES
        } else if (cmd === "-") {
            // Decrement the cell or set it to NUM_VALUES-1 if it is 0
            tape[ptr] = (tape[ptr] - 1 + NUM_VALUES) % NUM_VALUES
        } else if (cmd === ".") {
            // Output the cell
            player.say("§bOutput: §r" + (ioChar ? `"${String.fromCharCode(tape[ptr])}"` : tape[ptr]))
        } else if (cmd === ",") {
            // Set the cell to user input
            player.say("§bInput via input command:")
            input = undefined
            while (true) {
                // Wait for user input
                while (input == undefined) loops.pause(1)
                if (ioChar) {
                    // Clamp first character to have a code in the range 0 to NUM_VALUES-1
                    if (input.length > 1) player.say(`§eWarning: Only first character of input '${input}'('${input[0]}') will be used.`)
                    tape[ptr] = Math.max(0, Math.min(NUM_VALUES - 1, input.charCodeAt(0)))
                    break
                } else {
                    // If the number is valid, wrap it inside the range 0 to NUM_VALUES-1
                    let num: number = parseInt(input)
                    if (!isNaN(num)) {
                        tape[ptr] = ((num % NUM_VALUES) + NUM_VALUES) % NUM_VALUES
                        break
                    }
                    player.say(`§cError: Invalid input: ${input}`)
                }
            }
        } else if (cmd === "[") {
            if (tape[ptr] === 0) {
                // Skip to the matching ']'
                let depth: number = 1
                let cmd: string = ""
                agent.move(SixDirection.Forward, 1)
                while (true) {
                    if (++step === MAX_STEPS) {
                        player.say(`§cError: Code execution stopped, Step limit(${MAX_STEPS}) reached`)
                        return
                    }
                    cmd = getCommand()
                    if (cmd === "[") depth++
                    else if (cmd === "]") { if (--depth === 0) break }
                    else if (cmd === "n") {
                        // Move to a new line
                        agent.teleport(lineStart, orientation)
                        agent.move(SixDirection.Right, 1)
                        lineStart = agent.getPosition()
                        continue
                    } else if (cmd === "e") {
                        // End the script (Script should not end in a loop)
                        player.say(`§eWarning: Code finished with ${depth} unmatched '['`)
                        return
                    }
                    agent.move(SixDirection.Forward, 1)
                }
            } else {
                // Start a new loop
                loopStack.push(agent.getPosition())
                lineStartStack.push(lineStart)
            }
        } else if (cmd === "]") {
            if (loopStack.length === 0) {
                player.say("§eWarning: Unmatched ']' found. Continuing...")
                agent.move(SixDirection.Forward, 1)
                continue
            }
            if (tape[ptr] !== 0) {
                // Loop back to the matching '['
                let openPos: Position = loopStack[loopStack.length - 1]
                agent.teleport(openPos, orientation)
                lineStart = lineStartStack[lineStartStack.length - 1]
            } else {
                // End the loop
                loopStack.pop()
                lineStartStack.pop()
            }
        } else if (cmd === "n") {
            // Move to a new line
            agent.teleport(lineStart, orientation)
            agent.move(SixDirection.Right, 1)
            lineStart = agent.getPosition()
            continue
        } else if (cmd === "e") {
            // End the script
            if (loopStack.length === 0) break
            // Script should not end in a loop
            player.say(`§eWarning: Code finished with ${loopStack.length} unmatched '['`)
            return
        }
        if (step === MAX_STEPS) {
            player.say(`§cError: Code execution stopped, Step limit(${MAX_STEPS}) reached`)
            return
        }
        if (debugMode) player.say(`§l§2[Step ${step}]${cmd} Ptr: ${ptr}, Cell: ${tape[ptr]}`)
        agent.move(SixDirection.Forward, 1)
    }
    player.say("§aCode execution finished successfully.")
})
