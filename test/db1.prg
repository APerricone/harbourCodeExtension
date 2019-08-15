#include <fileio.ch>

function Main()

    local aMatch := hb_regexAll( '[a-z0-9_]+', "function Main()",.F./*CASE*/,/*line*/,/*nMat*/,/*nGet*/,.F./*onlyName*/)
    local n
    ErrorBlock({|e| MyErrorBlock(e) })
 
#ifndef __XHARBOUR__
    BEGIN SEQUENCE WITH {|oErr| BREAK( oErr ) }
#else
    try
#endif
        n:=1+{2}
        ? Len( aMatch )
    
        for n := 1 to Len( aMatch )
            ? "1: ",aMatch[ n,1,1 ], " from ", aMatch[ n,1,2 ],"to ",aMatch[ n,1,3 ]
        next
#ifndef __XHARBOUR__
    recover
#else
    catch
#endif
        ? "recover"
    end
 
 return nil

PROC MyErrorBlock(e)
    ? "ERRORISSIMO ",e:Description 
    
    