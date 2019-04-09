function Main()

   local aMatch := hb_regexAll( '[a-z0-9_]+', "function Main()",.F./*CASE*/,/*line*/,/*nMat*/,/*nGet*/,.F./*onlyName*/)
   local n
   ErrorBlock({|e| MyErrorBlock(e) })

   BEGIN SEQUENCE WITH {|| Break() }
   n:=1+{2}
   ? Len( aMatch )

   for n := 1 to Len( aMatch )
      ? "1: '",aMatch[ n,1,1 ], "' from ", aMatch[ n,1,2 ],"to ",aMatch[ n,1,3 ]
      // ? "2: " + aMatch[ n ][ 2 ]
   next
   recover
      ? "err"
   end sequence

return nil


PROC MyErrorBlock(e)
	? "ERRORISSIMO "
