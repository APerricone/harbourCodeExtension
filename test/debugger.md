# Debugger commands
The sended lines and the command are show with some variable between curly parenthesis, this names are used in the explanetion.

The debugger sends a
>STOP

when the execution stops (TODO: other types of stop support)

## GO
start the program until there is a breakpoint or an AltD call (TODO: error support)

## STEP
run to next line of code even if is in another procedure 

## NEXT
run to next line of code without calls

## STACK
require for stack, it is returned in this form:
> STACK {len}\
{prgFile}:{line}:{functionNames}

with the second line repeated {len} times

## LOCALS, STATICS, PRIVATES, PRIVATE_CALLEE, PUBLICS, GLOBALS, EXTERNALS
Require for variable list of this type, it must be followed with a line in this form:
> {stack}:{start}:{count}

where {stack} is the current stack, {start} is the first index of request variables (send 1 or below to request from first) and {count} is the number of request variables.

They are returned in this way:
> {prefix}:{idx1}:{idx2}:{idx3}:{name}:{type}:{value} \
> END

the first line is repeated for every variable returned. \
For Array, hash and classes the value is the lenght of contained children, if you resend a line of this type, followed by the stack, start 'n' count request, it return its children.
