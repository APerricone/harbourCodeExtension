#include <hbdebug.ch>
#include <hbmemvar.ch>
#include <hboo.ch>

THREAD STATIC t_oSocketDebug := nil

#define CRLF e"\r\n"
#ifndef DBG_PORT
// Temp, I hope to find another way to do InterProcessCommunication that uses ProcessId as unique key
// in the meanwhile, you can change the port using compiler command line argumend -D to set DBG_PORT
// to another value, it is useful if you need to debug 2 programm in the same time.
#define DBG_PORT 6110
#endif

PROCEDURE __dbgEntry( nMode, uParam1, uParam2, uParam3, uParam4 )
	local i, tmp
	switch nMode
   		CASE HB_DBG_GETENTRY

      		__dbgSetEntry()
      		exit

		CASE HB_DBG_ACTIVATE
			// if no server then start it.
			if(empty(t_oSocketDebug))
				hb_inetInit()
				t_oSocketDebug := hb_inetCreate()
				hb_inetTimeout( t_oSocketDebug,1000 )
				hb_inetConnect("127.0.0.1",DBG_PORT,t_oSocketDebug)
			endif
			if hb_inetErrorCode(t_oSocketDebug) <> 0
				//disconnected?
				OutErr(hb_inetErrorDesc(t_oSocketDebug)+CRLF)
   	  			__dbgSetGo( uParam1)
				return
			endif
			hb_inetSend(t_oSocketDebug,"STOP"+CRLF)
			//ErrorBlock( {| e | ErrorBlockCode( e ) } ) does not work, ask to comunity...
			
			do while .T.
				tmp := hb_inetRecvLine(t_oSocketDebug)
				if len(tmp)>0
					if subStr(tmp,4,1)==":"
						sendCoumpoundVar(uParam1, tmp, hb_inetRecvLine(t_oSocketDebug))
						loop
					endif
					switch tmp
						case "GO"
							__dbgSetGo( uParam1)
							return
						case "STEP" // go to next line of code even if is in another procedure
							return
						case "NEXT" // go to next line of same procedure
							__dbgSetTrace(uParam1)
							return
						case "STACK" 
							sendStack(uParam3)
							exit
						case "BREAKPOINT"
							setBreakpoint(uParam1,hb_inetRecvLine(t_oSocketDebug))
							exit
						case "LOCALS"
							sendFromStack(uParam3,hb_inetRecvLine(t_oSocketDebug),tmp,HB_DBG_CS_LOCALS)
							exit							
						case "STATICS"
							sendFromStack(uParam3,hb_inetRecvLine(t_oSocketDebug),tmp,HB_DBG_CS_STATICS)
							exit
						case "PRIVATES"
							sendFromInfo(tmp,hb_inetRecvLine(t_oSocketDebug),HB_MV_PRIVATE, .T., uParam3)
							exit
						case "PRIVATE_CALLEE"
							sendFromInfo(tmp,hb_inetRecvLine(t_oSocketDebug),HB_MV_PRIVATE, .F., uParam3)
							exit
						case "PUBLICS"
							sendFromInfo(tmp,hb_inetRecvLine(t_oSocketDebug),HB_MV_PUBLIC,, uParam3)
							exit
						//case "GLOBALS"
						//	sendVariables(HB_MV_PUBLIC,.F.)
						//	exit
						//case "EXTERNALS"
						//	sendVariables(HB_MV_PUBLIC,.F.)
						//	exit
						case "EXPRESSION"
							sendExpression(uParam1,hb_inetRecvLine(t_oSocketDebug))
							exit
					endswitch
				else
					hb_idleSleep(0.1)
				endif	
			enddo

   			exit
			
	ENDSWITCH

static procedure sendStack(aStack)
	local i, j, tmp, vv
	hb_inetSend(t_oSocketDebug,"STACK " + alltrim(str(len(aStack)))+CRLF)
	for i:=1 to len(aStack)
		hb_inetSend(t_oSocketDebug, aStack[i,HB_DBG_CS_MODULE]+ ;
			":"+alltrim(str(aStack[i,HB_DBG_CS_LINE]))+ ;
			":"+aStack[i,HB_DBG_CS_FUNCTION]+CRLF)
	next

static function format(value)
	switch valtype(value)
		case "U"
			return "nil"
		case "C"
		case "M"
			if at('"',value)==0
				return '"'+value+'"'
			elseif at("'",value)==0
				return "'"+value+"'"
			else
				return "["+value+"]" //i don't like it decontexted 
			endif
		case "N"
			return alltrim(str(value))
		case "L"
			return iif(value,".T.",".F.")
		case "D"
			return 'd"'+left(hb_TsToStr(value),10)+'"'
		case "T"
			return 't"'+hb_TsToStr(value)+'"'
		case "A"
		case "H"
			return alltrim(str(len(value)))
		case "B"
			return "{|| ...}"
		case "O"
			//return value:ClassName()+" "+alltrim(str(len(value)))
			return value:ClassName()+" "+alltrim(str(len(__objGetMsgList(value,.T.,HB_MSGLISTALL))))
		case "P"
			return "Pointer"
		case "S"
			RETURN "@" + value:name + "()"
		endswitch
return ""

static function fixVarCParams(cParams, lenStack, lenVars)
	local aParams := hb_aTokens(cParams,":")
	local iStack := val(aParams[1])
	local iStart := val(aParams[2])
	local iCount := val(aParams[3])
	local aInfo, value, cLine 
	iStack:= iif(iStack>lenStack	, lenStack	, iStack)
	iStack:= iif(iStack<1			, 1				, iStack)
	if valType(lenVars) == "B"
		lenVars:=eval(lenVars,iStack)
	endif
	iStart:= iif(iStart>lenVars		, lenVars , iStart )
	iStart:= iif(iStart<1			, 1				, iStart )
	iCount:= iif(iCount<1			, lenVars , iCount )
	return {iStack, iStart, iCount}


static procedure sendFromStack(aStack,cParams,prefix,DBG_CS)
	local aParams := fixVarCParams(cParams,len(aStack),{|iStack| len(aStack[iStack,DBG_CS])} )
	local iStack := aParams[1]
	local iStart := aParams[2]
	local iCount := aParams[3]
	local i, aInfo, value, cLine, level
	hb_inetSend(t_oSocketDebug,prefix+" "+alltrim(str(iStack))+CRLF)
	for i:=iStart to iStart+iCount
		if(i>len(aStack[iStack,DBG_CS]))
			exit
		endif
		aInfo := aStack[iStack,DBG_CS,i]
		if DBG_CS == HB_DBG_CS_LOCALS
			value := __dbgVMVarLGet( __dbgProcLevel()-aInfo[ HB_DBG_VAR_FRAME ], aInfo[ HB_DBG_VAR_INDEX ] )
		else
			value := __dbgVMVarSGet( aInfo[ HB_DBG_VAR_FRAME ], aInfo[ HB_DBG_VAR_INDEX ] )
		endif
		// LOC:LEVEL:IDX::
		cLine := left(prefix,3) + ":" + alltrim(str(aInfo[ HB_DBG_VAR_FRAME ])) + ":" + ;
				 alltrim(str(aInfo[ HB_DBG_VAR_INDEX ])) + "::" + ;
				 aInfo[HB_DBG_VAR_NAME] + ":" + valtype(value) + ":" + format(value)
		hb_inetSend(t_oSocketDebug,cLine + CRLF )
	next
	hb_inetSend(t_oSocketDebug,"END"+CRLF)

static procedure sendFromInfo(prefix, cParams, HB_MV, lLocal,aStack)
	local nVars := __mvDbgInfo( HB_MV )
	local aParams := fixVarCParams(cParams,len(aStack),__mvDbgInfo( HB_MV ))
	local iStack := aParams[1]
	local iStart := aParams[2]
	local iCount := aParams[3]
	local i, cLine, cName, value
	local nLocal := __mvDbgInfo( HB_MV_PRIVATE_LOCAL, aStack[iStack,HB_DBG_CS_LEVEL] )
	hb_inetSend(t_oSocketDebug,prefix+" "+alltrim(str(iStack))+CRLF)
	nVars := __mvDbgInfo( HB_MV )
	for i:=iStart to iStart+iCount
	//for i:=1 to nVars
		if i > nVars
			loop
		endif
		if HB_MV = HB_MV_PRIVATE 
			if lLocal .and. i>nLocal
				loop
			endif
			if .not.  lLocal .and. i<=nLocal
				loop
			endif
		endif
		value := __mvDbgInfo( HB_MV, i, @cName )
		// PRI::i:
		cLine := left(prefix,3) + "::" + alltrim(str(i)) + "::" +;
				  cName + ":" + valtype(value) + ":" + format(value)
		hb_inetSend(t_oSocketDebug,cLine + CRLF )
	next

	hb_inetSend(t_oSocketDebug,"END"+CRLF)	

static function getValue(debugInfo,req)
	local aInfos := hb_aTokens(req,":")
	local v, i, aIndices
	switch aInfos[1]
		case "LOC"
			v := __dbgVMVarLGet(__dbgProcLevel()-val(aInfos[2]),0+val(aInfos[3]))
			exit
		case "STA"
			v := __dbgVMVarSGet(val(aInfos[2]),val(aInfos[3]))
			exit
		case "GLO"
		case "EXT"
			v := __dbgVMVarSGet(val(aInfos[2]),val(aInfos[3]))
			exit
		case "PRI"
			v := __mvDbgInfo(HB_MV_PRIVATE,val(aInfos[3]))
			exit
		case "PUB"
			v := __mvDbgInfo(HB_MV_PUBLIC,val(aInfos[3]))
			exit
		case "EXP"
			v := __dbgGetExprValue( debugInfo, aInfos[2] )
	endswitch
	// some variable changes its type during execution. mha
	if at(valtype(v),"AHO") == 0
		return {}
	endif
	req := aInfos[1]+":"+aInfos[2]+":"+aInfos[3]+":"+aInfos[4]
	if len(aInfos[4])>0
		aIndices := hb_aTokens(aInfos[4],",")
		for i:=1 to len(aIndices)
			switch(valtype(v))
				case "A"
					v:=v[val(aIndices[i])]
					exit
				case "H"
					//TODO: support not character hashes keys
					v := hb_HGetDef(v,aIndices[i],nil)
					exit
				case "O"
					v :=  __objSendMsg(v,aIndices[i])
			endswitch
		next
	endif	
return v

static procedure sendCoumpoundVar(debugInfo,req, cParams )
	local value := getValue(debugInfo,@req)
	local aParams := fixVarCParams(cParams,1,len(value))
	local iStack := aParams[1]
	local iStart := aParams[2]
	local iCount := aParams[3]
	local i, idx,vSend, cLine, aData
	if valtype(value) == "O"
		aData := __objGetValueList(value)
		aParams := fixVarCParams(cParams,1,len(aData))
		iStack := aParams[1]
		iStart := aParams[2]
		iCount := aParams[3]
	endif
	hb_inetSend(t_oSocketDebug,req+CRLF)
	if right(req,1)<>":"
		req+=","
	endif
	for i:=iStart to iStart+iCount
	//for i:=1 to nVars
		if i > len(Value)
			loop
		endif
		switch(valtype(value))
			case "A"
				idx := alltrim(str(i))
				vSend:=value[i]
				exit
			case "H"
				idx:=hb_HKeyAt(value,i)
				//TODO: support not character hashes keys
				vSend:=hb_HGetDef(value,idx,nil)
				exit
			case "O"
				idx := aData[i,1]
				vSend := aData[i,2]
				exit
		endswitch
		cLine := req + idx + ":" +;
				  idx + ":" + valtype(vSend) + ":" + format(vSend)
		hb_inetSend(t_oSocketDebug,cLine + CRLF )
	next

	hb_inetSend(t_oSocketDebug,"END"+CRLF)	

static procedure setBreakpoint(debugInfo, cInfo)
	LOCAL aInfos := hb_aTokens(cInfo,":"), id
	local nReq, nLine
	nReq := val(aInfos[3])
	if aInfos[1]=="-"
		// remove
		id := __dbgIsBreak(debugInfo,aInfos[2],nReq)
		if id>1
			__dbgDelBreak(id)
		endif
		hb_inetSend(t_oSocketDebug,"BREAK:"+aInfos[2]+":"+aInfos[3]+":-1:request"+CRLF)
		return
	endif
	if aInfos[1]<>"+"
		hb_inetSend(t_oSocketDebug,"BREAK:"+aInfos[2]+":"+aInfos[3]+":-1:invalid request"+CRLF)
		return
	endif
	nLine := nReq
	while .not. __dbgIsValidStopLine(debugInfo,aInfos[2],nLine)
		nLine++
		if (nLine-nReq)>2
			exit
		endif
	enddo
	if .not. __dbgIsValidStopLine(debugInfo,aInfos[2],nLine)
		nLine := nReq - 1
		while .not. __dbgIsValidStopLine(debugInfo,aInfos[2],nLine)
			nLine--
			if (nReq-nLine)>2
				exit
			endif
		enddo
	endif
	if .not. __dbgIsValidStopLine(debugInfo,aInfos[2],nLine)
		hb_inetSend(t_oSocketDebug,"BREAK:"+aInfos[2]+":"+aInfos[3]+":-1:invalid"+CRLF)
	endif
	__dbgAddBreak(debugInfo,aInfos[2],nLine)
	hb_inetSend(t_oSocketDebug,"BREAK:"+aInfos[2]+":"+aInfos[3]+":"+alltrim(str(nLine))+CRLF)

STATIC PROCEDURE ErrorBlockCode( e )
	local t
	hb_inetSend(t_oSocketDebug,"ERROR:"+e:Description+CRLF)
	? "ERROR:"+e:Description
	__dbgInvokeDebug(.T.)
	AltD()
	break(e)
	for t:=1 to 10
		break(e)
	next

static procedure sendExpression(debugInfo, xExpr)
	LOCAL xResult, cType
   	LOCAL oErr
	local lValid := .F.

	xResult := __dbgGetExprValue( debugInfo, xExpr, @lValid )
   	IF lValid
		cType := valtype(xResult)
		xResult := format(xResult)
	else
		cType := "E"
		oErr := xResult
		IF oErr:ClassName() == "ERROR"
			xResult := oErr:operation + ": " + oErr:description
			IF HB_ISARRAY( oErr:args )
				xResult += "; arguments:"
				AEval( oErr:args, {| x, i | xResult += iif( i == 1, " ", ", " ) + ;
					format( x ) } )
			ENDIF
		ELSE
			xResult := "Syntax error"
		ENDIF
	ENDIF

	hb_inetSend(t_oSocketDebug,"EXPRESSION:"+cType+":"+xResult+CRLF)
