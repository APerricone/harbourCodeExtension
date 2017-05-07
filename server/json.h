#pragma once
#include <map>
#include <vector>

class JSONElement
{
public:
	enum type
	{
		eObject,
		eArray,
		eString,
		eNumber,
		eBool,
		eNull
	} eType;
	union
	{
		std:map<char*,JSONElement> object;
		std:vector<JSONElement> array;
		char* string;
		float number;
		bool boolean;
	};
	
	char* parse(char* str) { return parse(str,this); }
	int toString(char* d,int l) const { return toString(d,l,*this); }

	const char* getLastError() const { return lastError; }	
		
private:
	char* lastError;
	/// parse sub methods
	char* skipSpaces(char*);
	char* parse(char*,JSONElement*);
	char* parseObject(char*,JSONElement*);
	char* parseArray(char*,JSONElement*);
	char* parseString(char*,JSONElement*);
	char* parseStringCheck(char*,char**);
	char* parseNumber(char*,JSONElement*);
	char* parseBool(char*,JSONElement*);
	/// toString sub methods
	int toString(char*,int,const JSONElement&);
	int toStringObject(char*,int,const JSONElement&);
	int toStringArray(char*,int,const JSONElement&);
	int toStringString(char*,int,const JSONElement&);
	int toStringNumber(char*,int,const JSONElement&);
	int toStringBool(char*,int,const JSONElement&);
};

