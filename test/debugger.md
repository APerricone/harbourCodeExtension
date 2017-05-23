# Debugger commands
The sended lines and the command are show with some variable between curly parenthesis, this names are used in the explanetion.

The debugger sends a
>START

when the program just starts

>STOP

when the execution stops (TODO: other types of stop support)

## GO
start the program until there is a breakpoint or an AltD call (TODO: error support)

## STEP
run to next line of code even if is in another procedure 

## NEXT
run to next line of code without calls

## BREAKPOINT
Add/remove a breakpoint, it must be followed by a line in this form:

> {+/-}:{prgFile}:{line}

It will be responded by a line in this form

>BREAK:{prgFile}:{lineReq}:{lineSet}:{reason}

where {lineReq} is the requested line, and {lineSet} is the nearest next line where it can be set, or -1 if the request is for deletion or the debbuger is not be able to set the breakpoint, in this case the {reason} is filled with "invalid line" or "invalid module".


## STACK
require for stack, it is returned in this form:
> STACK {len}\
{prgFile}:{line}:{functionNames}

with the second line repeated {len} times

## LOCALS, STATICS, PRIVATES, PRIVATE_CALLEE, PUBLICS, GLOBALS, EXTERNALS
Require for variable list of this type, it must be followed by a line in this form:
> {stack}:{start}:{count}

where {stack} is the current stack, {start} is the first index of request variables (send 1 or below to request from first) and {count} is the number of request variables.

They are returned in this way:
> {prefix}:{idx1}:{idx2}:{idx3}:{name}:{type}:{value} \
> END

the first line is repeated for every variable returned. \
For Array, hash and classes the value is the lenght of contained children.
if you send a line like:

> {prefix}:{idx1}:{idx2}:{idx3}

followed by the stack, start 'n' count request, it return its children.
