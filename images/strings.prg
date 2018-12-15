#include <hbxpp.ch>
proc main()
    LOCAL cString1 := "string1"
    LOCAL cString2 := 'string2'
    LOCAL cString3 := [string3]
    LOCAL cLongString, cEscaped := e"escaped\cmultiline\r\ntext"
    #pragma __text | cLongString+="%s" | | cLongString:="" 
    Other string
    multiline
    all this text will be put inside cLongString
    #pragma __endtext
    TEXT INTO cLongString
    this mode is xHarbour style
    ENDTEXT